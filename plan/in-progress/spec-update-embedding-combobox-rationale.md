---
worktree: unified-model-mgmt-5af7ee
started: 2026-06-11
owner: resolution-applier
---
# Spec Update Draft — embedding-combobox-rationale

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영): 구현이 spec Rationale 을 의도적으로 개선함.
코드가 맞고 spec Rationale 이 낡았다. 코드를 되돌리지 않는다.

## 원본 발견사항
SUMMARY#INFO1: [SPEC-DRIFT] spec Rationale 에 `EmbeddingModelCombobox 신설...` 문장이
남아 있으나 코드는 의도적으로 단일 NativeSelect 로 개선됨 — spec Rationale 갱신 필요.

위치: `spec/5-system/8-embedding-pipeline.md` Rationale ~line 379

## 제안 변경

### Before (현재 spec Rationale 문장)
```
EmbeddingModelCombobox 신설 — 기존 llm-configs 드롭다운 대신 kind=embedding ModelConfig 전용
셀렉터를 새로 만들어 모델 불러오기 버튼으로 조회, 선택 가능하도록 구현.
```
(정확한 문장은 spec 파일 line 379 인근 확인 필요)

### After (제안)
```
단일 NativeSelect(kind=embedding ModelConfig 목록 직접 선택; config.defaultModel 사용) —
KB 생성/편집 폼에서 kind=embedding ModelConfig 목록을 단일 NativeSelect 로 제공. 선택된
config 의 defaultModel 을 백엔드가 서버 사이드로 파생해 KB.embeddingModel 에 저장하므로
별도 "모델 불러오기" 버튼이 필요 없다. EmbeddingModelCombobox 컴포넌트는 신설되지 않음.
```

## 변경 영향 범위
- `spec/5-system/8-embedding-pipeline.md` § Rationale 의 해당 bullet 1건 교체.
- 다른 spec 파일 변경 불필요.

## 호출자 후속 절차
1. `/consistency-check --spec` 실행으로 BLOCK 여부 확인.
2. BLOCK:NO 시 project-planner 가 spec 문서 갱신.
3. 갱신 완료 후 resolution-applier 재호출 (동일 session_dir) — idempotency 로 코드 항목은
   skip, spec draft 만 `spec_drafts_applied` 로 이동 처리.
