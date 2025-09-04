'use client'

import { Chat } from "@/app/chat";

export function DesktopView() {
    return (
        <div className="mb-2 flex flex-1 w-full min-h-0 overflow-hidden">
            {/* Full Width Chat Interface */}
            <div className="w-full h-full ml-2 mr-2">
                <Chat 
                    className="flex-1 overflow-hidden" 
                    isMobile={false} 
                />
            </div>
        </div>
    )
}
