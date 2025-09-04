import {
  type UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from 'ai'
import { DEFAULT_MODEL } from '@/ai/constants'
import { NextResponse } from 'next/server'
import { getAvailableModels } from '@/ai/gateway'
// import { checkBotId } from 'botid/server'
import { tools } from '@/ai/tools'
import { generateSystemPrompt, getRepoPrompt } from './prompt'
import { logger } from '@/lib/logger'
import { customModel } from '@/ai'

interface BodyData {
  messages: UIMessage[]
  modelId?: string
  userEmail?: string
  customerId?: string
  sandboxId?: string
  sessionId?: string
  github?: {
    repo: string;
    branch: string;
    accessToken: string;
  }
}

export async function POST(req: Request) {
  const startTime = Date.now()
  
  logger.api('/api/chat', 'POST', 'Received chat request')

  try {
    logger.info('Checking bot detection', { endpoint: '/api/chat' })
    
    // const checkResult = await checkBotId()
    // if (checkResult.isBot) {
    //   logger.warn('Bot detected, rejecting request', { 
    //     endpoint: '/api/chat',
    //     botCheck: checkResult 
    //   })
    //   return NextResponse.json({ error: `Bot detected` }, { status: 403 })
    // }

    logger.info('Loading models and parsing request body', { endpoint: '/api/chat' })

    const [models, { messages, modelId = DEFAULT_MODEL, userEmail, customerId, sandboxId, sessionId, github }] = await Promise.all([
      getAvailableModels(),
      req.json() as Promise<BodyData>,
    ])

    const repoUrl = github?.repo && `https://github.com/${github.repo}.git`;

    const customerIdVal = customerId || userEmail
    const lastMessage = messages[messages.length - 1]
    logger.api('/api/chat', 'POST', 'Request parsed successfully', {
      modelId,
      messagesCount: messages.length,
      lastMessageRole: lastMessage?.role,
      lastMessageParts: lastMessage?.parts?.length || 0,
      defaultModel: DEFAULT_MODEL,
      repoCloneUrl: repoUrl,
      repoBranchName: github?.branch
    })

    const model = models.find((model) => model.id === modelId)
    if (!model) {
      logger.error('Model not found', undefined, {
        requestedModelId: modelId,
        availableModels: models.map(m => m.id),
        endpoint: '/api/chat'
      })
      return NextResponse.json(
        { error: `Model ${modelId} not found.` },
        { status: 400 }
      )
    }

    logger.api('/api/chat', 'POST', 'Starting AI stream', {
      modelName: model.name,
      modelId: model.id,
      messagesCount: messages.length
    })

    
    const _isGitTask = repoUrl ? true : false
    
    if(messages.length>0 && messages[0].role === "user" && messages[0].parts[0].type === "text" && repoUrl && github?.branch){
      messages[0].parts[0].text = messages[0].parts[0].text + "\n\n" + getRepoPrompt(repoUrl, github?.branch)
    }
    // Generate dynamic system prompt with customer context
    const systemPrompt = generateSystemPrompt(customerIdVal, _isGitTask);

    const response = createUIMessageStreamResponse({
      stream: createUIMessageStream({
        originalMessages: messages,
        execute: ({ writer }) => {
          const streamStartTime = Date.now()
          
          logger.info('Stream execution started', {
            endpoint: '/api/chat',
            modelName: model.name,
            streamStartTime
          })
          
          const result = streamText({
            model: customModel(modelId, customerIdVal),
            system: systemPrompt,
            messages: convertToModelMessages(
              messages,
              {
                ignoreIncompleteToolCalls: true,
              }
            ),
            stopWhen: stepCountIs(200),
            tools: tools({ modelId, customerId: customerIdVal, writer, github, sessionId }),
            maxRetries: 3,
            onError: (error) => {
              const errorObj = error.error instanceof Error ? error.error : new Error(String(error.error || 'Unknown error'))
              logger.error('AI communication error during streaming', errorObj, {
                endpoint: '/api/chat',
                modelId,
                modelName: model.name,
                errorMessage: errorObj.message || 'Unknown error',
                errorStack: errorObj.stack
              })
            },
          })
          
          result.consumeStream()
          
          const uiStream = result.toUIMessageStream({
            sendStart: false,
            messageMetadata: () => ({
              model: model.name,
            }),
          })
          
          // Enhanced logging for streaming data
          const originalWrite = writer.write
          let messageCount = 0
          writer.write = function(data) {
            messageCount++
            
            logger.debug('Streaming data to UI', {
              endpoint: '/api/chat',
              messageNumber: messageCount,
              dataType: typeof data,
              dataPreview: JSON.stringify(data).substring(0, 200),
              streamDuration: Date.now() - streamStartTime
            })
            
            return originalWrite.call(this, data)
          }
          
          logger.info('Merging UI stream', {
            endpoint: '/api/chat',
            modelName: model.name
          })
          
          writer.merge(uiStream)
        },
      }),
    })

    // Force HTTP/2 by disabling QUIC to prevent net::ERR_QUIC_PROTOCOL_ERROR
    response.headers.set('Alt-Svc', 'clear')
    
    // Improve streaming stability with connection headers
    response.headers.set('Connection', 'keep-alive')
    response.headers.set('Cache-Control', 'no-cache')
    response.headers.set('X-Accel-Buffering', 'no')

    return response
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Chat API request failed', error, {
      endpoint: '/api/chat',
      duration,
      method: 'POST'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
