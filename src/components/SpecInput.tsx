import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SpecItem {
    category: 'dimensions' | 'material' | 'function' | 'other';
    value: string;
    detail: string;
}

interface SpecInputProps {
    specs: SpecItem[];
    onChange: (specs: SpecItem[]) => void;
}

export function SpecInput({ specs, onChange }: SpecInputProps) {
    const addSpec = () => {
        onChange([...specs, { category: 'other', value: '', detail: '' }]);
    };

    const removeSpec = (index: number) => {
        const newSpecs = [...specs];
        newSpecs.splice(index, 1);
        onChange(newSpecs);
    };

    const updateSpec = (index: number, field: keyof SpecItem, value: string) => {
        const newSpecs = [...specs];
        newSpecs[index] = { ...newSpecs[index], [field]: value };
        onChange(newSpecs);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label>제품 스펙 (Spec-to-Story용)</Label>
                <Button variant="outline" size="sm" onClick={addSpec} type="button">
                    <Plus className="w-4 h-4 mr-1" /> 스펙 추가
                </Button>
            </div>

            {specs.length === 0 && (
                <div className="text-sm text-muted-foreground bg-slate-50 p-4 rounded-md text-center border border-slate-100">
                    등록된 스펙이 없습니다. '스펙 추가' 버튼을 눌러 정보를 입력하세요.<br />
                    (예: 규격 - W1200, 기능 - 전동 모터)
                </div>
            )}

            <div className="space-y-3">
                {specs.map((spec, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 bg-white border rounded-md shadow-sm">
                        <div className="w-1/4 min-w-[100px]">
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={spec.category}
                                onChange={(e) => updateSpec(index, 'category', e.target.value as any)}
                            >
                                <option value="dimensions">규격 (Size)</option>
                                <option value="material">소재 (Material)</option>
                                <option value="function">기능 (Function)</option>
                                <option value="other">기타</option>
                            </select>
                        </div>
                        <div className="flex-1 space-y-2">
                            <Input
                                placeholder="핵심 스펙 (예: W1200, E0 등급, 듀얼모터)"
                                value={spec.value}
                                onChange={(e) => updateSpec(index, 'value', e.target.value)}
                            />
                            <Input
                                placeholder="상세 설명 (선택 사항)"
                                value={spec.detail}
                                onChange={(e) => updateSpec(index, 'detail', e.target.value)}
                                className="text-xs text-muted-foreground h-8"
                            />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeSpec(index)} type="button" className="text-muted-foreground hover:text-red-500">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
