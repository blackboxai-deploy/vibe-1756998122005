import { NextRequest, NextResponse } from 'next/server'
import { getSandbox } from '@/lib/services/vercelSandbox'
import z from 'zod/v3'
import { logger } from '@/lib/logger'

const ConnectRequestSchema = z.object({
  sandboxId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  logger.api('/api/sandboxes/connect', 'POST', 'Received sandbox connection request')

  try {
    logger.info('Parsing sandbox connection request body', { endpoint: '/api/sandboxes/connect' })

    // Parse request body
    const body = await request.json()
    const validatedData = ConnectRequestSchema.safeParse(body)

    if (!validatedData.success) {
      logger.warn('Invalid sandbox connection request data', {
        endpoint: '/api/sandboxes/connect',
        errors: validatedData.error.errors,
        receivedBody: body
      })

      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error.errors },
        { status: 400 }
      )
    }

    const { sandboxId } = validatedData.data

    logger.api('/api/sandboxes/connect', 'POST', 'Attempting to connect to sandbox', {
      sandboxId
    })

    // Try to get the sandbox
    try {
      logger.sandbox(sandboxId, 'Getting sandbox instance for connection')

      const sandbox = await getSandbox({ sandboxId })
      
      if (!sandbox) {
        logger.warn('Sandbox not found during connection attempt', {
          sandboxId,
          endpoint: '/api/sandboxes/connect'
        })

        return NextResponse.json(
          { error: 'Sandbox not found' },
          { status: 404 }
        )
      }

      logger.sandbox(sandboxId, 'Sandbox connection successful', {
        sandboxId: sandbox.sandboxId
      })

      // Get basic sandbox info
      const sandboxInfo = {
        sandboxId: sandbox.sandboxId,
        // Add any other relevant sandbox information
      }

      const duration = Date.now() - startTime
      logger.performance('sandbox-connection', duration, {
        sandboxId,
        endpoint: '/api/sandboxes/connect'
      })

      logger.api('/api/sandboxes/connect', 'POST', 'Sandbox connection completed successfully', {
        sandboxId,
        duration
      })

      return NextResponse.json({
        success: true,
        sandbox: sandboxInfo,
      })

    } catch (sandboxError) {
      const duration = Date.now() - startTime
      logger.error('Failed to connect to sandbox', sandboxError, {
        sandboxId,
        endpoint: '/api/sandboxes/connect',
        duration
      })

      return NextResponse.json(
        { error: 'Failed to connect to sandbox. It may not exist or may have expired.' },
        { status: 404 }
      )
    }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Sandbox connection API error', error, {
      endpoint: '/api/sandboxes/connect',
      duration,
      method: 'POST'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
