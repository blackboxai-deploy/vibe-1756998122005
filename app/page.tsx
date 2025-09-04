import { DesktopView } from '@/components/desktop-view'
import { getDeviceType } from '@/lib/device-detection'
import { Chat } from './chat'
import { Header } from './header'
import { Preview } from './preview'

export default async function Page() {
  const { isMobile } = await getDeviceType()
  
  return (
    <>
      {/* <Welcome defaultOpen={banner} onDismissAction={hideBanner} /> */}
      <div className="flex flex-col overflow-hidden space-y-2 h-[100dvh] max-h-[100dvh]">
        <Header 
          isMobile={isMobile}
          previewContent={
            <Preview className="h-full flex-1 overflow-hidden" isMobile={isMobile} />
          }
        />
        
        {isMobile ? (
          /* Mobile Layout */
          <div className="flex-1 min-h-0">
            <Chat className="flex-1 overflow-hidden" isMobile={isMobile} />
          </div>
        ) : (
          /* Desktop Layout - Full Width Chat */
          <DesktopView />
        )}
      </div>
    </>
  )
}
