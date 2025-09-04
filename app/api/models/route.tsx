import { MODEL_NAME_MAP } from '@/ai/constants'
import { getAvailableModels } from '@/ai/gateway'
import { NextResponse } from 'next/server'

export async function GET() {
  const allModels = await getAvailableModels()
  return NextResponse.json({
    models: allModels.filter((model) => Object.keys(MODEL_NAME_MAP).includes(model.id)),
  })
}
