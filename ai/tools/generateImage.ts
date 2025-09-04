import { streamText } from "ai";
import { getModelOptions } from "../gateway";

// Utility function showing how to properly use model options
async function generateTextWithModelOptions(query: string, modelId: string) {
  try {
    const { generateText } = await import('ai');
    const modelOptions = getModelOptions(modelId);
    
    const result = await generateText({
      ...modelOptions,
      messages: [{ role: "user", content: query }],
      maxRetries: 3,
    });
    
    return result.text;
  } catch (error) {
    console.error('Error generating text:', error);
    return null;
  }
}

// Alternative: If you need streaming with model options
async function* streamTextWithModelOptions(query: string, modelId: string) {
  try {
    const { streamText } = await import('ai');
    const modelOptions = getModelOptions(modelId);
    
    const result = streamText({
      ...modelOptions,
      messages: [{ role: "user", content: query }],
      maxRetries: 3,
    });
    
    for await (const chunk of result.textStream) {
      yield { type: "text", text: chunk };
    }
  } catch (error) {
    console.error('Error streaming text:', error);
    yield { type: "error", text: "Failed to generate text" };
  }
}

export async function uploadToGCB(imgBase64: any) {
    try {
      const response = await fetch('https://www.codegeneration.ai/convert-base64-to-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imgBase64 }),
      });
  
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error fetching markdown:', error);
      return null;
    }
  }

export const image_models: any = {
  base: "black-forest-labs/flux-schnell",
  pro: "black-forest-labs/flux-kontext-max"
}

export async function generateImage(query: any, sessionId: any, selected_model: any, messageWithImage?: any, imgenModel?: string) {

  if (query?.startsWith('/web ')) {
    query = query.replace('/web ', '');
  }

  let model_selected: any = "black-forest-labs/flux-kontext-max"
  
  if (!model_selected || model_selected === null || model_selected === undefined){
    return null
  }

  if (model_selected !== image_models.base && model_selected !== image_models.pro){
    return null
  }

  try {

    let imageBASE64: any = null

    let request_body: any = {
      input: {
        prompt: query
      }
    }

    if (messageWithImage) {
      try {
        imageBASE64 = messageWithImage?.data?.imagesData[0]?.contents
        let imageURL = await uploadToGCB(imageBASE64)
        request_body.input['input_image'] = imageURL
      } catch (error) {
        console.error(error)
      }
    }
    
    if (model_selected) {
      try {
        let output: any = '';
        
        // Handle image generation models with your OpenAI client pattern
        if (model_selected === "black-forest-labs/flux-kontext-max" || model_selected === "black-forest-labs/flux-schnell") {
          // Create a simple fetch-based OpenAI client call
          const baseMessages: any[] = [];
          baseMessages.push({ role: "user", content: query });
          
          // Add image input if provided
          if (messageWithImage && request_body.input.input_image) {
            baseMessages[0].content = [
              { type: "text", text: query },
              { type: "image_url", image_url: { url: request_body.input.input_image } }
            ];
          }
          
          const response = await fetch(`${process.env.LITELLM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'customerId': 'cus_SI19yrM95BDIk5'
            },
            body: JSON.stringify({
              model: model_selected,
              messages: baseMessages,
              stream: false,
              max_tokens: 1000,
              temperature: 0.7
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`LiteLLM API error: ${response.status} ${response.statusText}`, errorText);
            return null;
          }
          
          const testoutput = await response.json();
          output = testoutput.choices[0].message.content || "";
          console.log("Generated output:", output);
        }
        
        // Handle different output formats to extract image URL
        let imageUrl: string | null = null;
        
        if (typeof output === 'string') {
          // Try to extract URL from string output
          const urlPattern = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif)/i;
          const urlMatch = output.match(urlPattern);
          if (urlMatch) {
            imageUrl = urlMatch[0];
          } else if (output.startsWith('http')) {
            imageUrl = output.trim();
          }
        } else if (output && typeof output.url === 'function') {
          imageUrl = output.url();
        } else if (output && output.url && typeof output.url === 'string') {
          imageUrl = output.url;
        } else if (Array.isArray(output) && output.length > 0) {
          imageUrl = output[0];
        }
        
        console.log("Generated image URL:", imageUrl);
        
        if (imageUrl) {
          try {
            // Fetch the image and convert to base64
            const imageResponse = await fetch(imageUrl);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString('base64');
            const image_base64 = `data:image/webp;base64,${base64}`;
            
            const uploadedImageUrl = await uploadToGCB(image_base64);
            
            return `${uploadedImageUrl}`;
          } catch (fetchError) {
            console.error('Error fetching/processing image:', fetchError);
            return null;
          }
        }
        
      } catch (error) {
        console.error('Error generating image:', error);
        return null;
      }
    }
    return null;
  } catch (e: any) {
    console.log('==>error:', e);
    return null;
  }
}
