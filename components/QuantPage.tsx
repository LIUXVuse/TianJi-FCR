import React, { useState } from 'react';
import { ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';

// 量化系統通過 Vite proxy 載入，所以使用相對路徑
const QUANT_URL = '/quant/';

export const QuantPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const handleIframeLoad = () => {
        setLoading(false);
    };

    const handleIframeError = () => {
        setLoading(false);
        setError(true);
    };

    const handleRefresh = () => {
        setLoading(true);
        setError(false);
        const iframe = document.querySelector('iframe') as HTMLIFrameElement;
        if (iframe) {
            iframe.src = iframe.src;
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* 工具列 */}
            <div className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-lg border-b border-gray-700">
                <span className="text-emerald-400 font-bold flex items-center gap-2">
                    📈 量化回測系統
                    <span className="text-xs text-gray-500 font-normal">tw-quant-simple</span>
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                        title="重新載入"
                    >
                        <RefreshCw size={14} /> 重整
                    </button>
                    <button
                        onClick={() => window.open('http://localhost:8000', '_blank')}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                        title="在新視窗開啟"
                    >
                        <ExternalLink size={14} /> 新視窗
                    </button>
                </div>
            </div>

            {/* iframe 嵌入區域 */}
            <div className="flex-1 relative bg-gray-900 rounded-b-lg overflow-hidden">
                {/* 載入中提示 */}
                {loading && (
                    <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-10">
                        <RefreshCw className="animate-spin text-emerald-400 mb-3" size={40} />
                        <span className="text-gray-400">正在載入量化系統...</span>
                        <span className="text-gray-600 text-xs mt-2">請確認後端已啟動 (port 8000)</span>
                    </div>
                )}

                {/* 錯誤提示 */}
                {error && (
                    <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-10">
                        <AlertCircle className="text-red-400 mb-3" size={40} />
                        <span className="text-red-400 font-bold">無法連接量化系統</span>
                        <span className="text-gray-500 text-sm mt-2">請確認後端服務已啟動</span>
                        <code className="text-gray-600 text-xs mt-3 bg-gray-800 px-3 py-2 rounded">
                            cd tw-quant-simple && source .venv/bin/activate && python -m uvicorn web.app:app --port 8000
                        </code>
                        <button
                            onClick={handleRefresh}
                            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
                        >
                            重試連接
                        </button>
                    </div>
                )}

                {/* 量化系統 iframe */}
                <iframe
                    src={QUANT_URL}
                    className="w-full h-full border-0"
                    onLoad={handleIframeLoad}
                    onError={handleIframeError}
                    title="量化回測系統"
                    allow="clipboard-write"
                />
            </div>
        </div>
    );
};
