---
worktree: llm-model-select-4857c3
started: 2026-05-26
owner: developer
---

# LLM 설정 / 임베딩 모델 선택 — select-only 전환

## 배경 / 사용자 요청

사용자 요청 (2026-05-26):
> LLM 설정 페이지에서 모델 선택을 사용자가 임의로 입력하는 방식은 제거하고, 모델을 불러온 후, select로 선택할 수 있게 변경해줘. 지식 저장소 설정의 임베딩 모델도 마찬가지야.

현재 UI 는 `<Input list="datalist">` 기반 combobox 라 사용자가 직접 자유 입력이 가능. 사용자가 잘못된 모델 ID 를 적어 저장 → 런타임 호출 실패로 이어지는 사례 차단을 위해 **select-only** 로 전환.

## 영향 spec

- `spec/2-navigation/6-config.md` §B.2 "기본 모델 선택 UX" — 현재 "직접 입력 가능" 명시. **select-only 로 수정**.
- `spec/2-navigation/5-knowledge-base.md` §2.2 "임베딩 모델" — 현재 사실상 자유 입력 허용. **select-only + 모델 불러오기 버튼** 으로 수정.

> spec 변경은 본 plan 안에서 직접 처리 (developer 가 small wording 갱신 + Rationale 보강. 신규 정의·대규모 개정 아님).

## 변경 항목

### 1. Spec
- `spec/2-navigation/6-config.md` §B.2
  - 표 "기본 모델" 행: "프로바이더 모델 조회 API에서 받아온 목록에서 선택" 으로 단순화.
  - "기본 모델 선택 UX" 하위 bullet:
    - 생성/수정 플로우는 동일하되 select 컴포넌트로 노출.
    - "Fallback" bullet 삭제. 조회 실패 시 입력 자체 불가, error 메시지만 표시.
  - `## Rationale` 섹션 신규 — select-only 결정의 근거 기록.
- `spec/2-navigation/5-knowledge-base.md` §2.2
  - "임베딩 모델" 행 설명 갱신: "지정된 LLMConfig 의 임베딩 모델 목록을 불러와 select 로 선택".
  - `## Rationale` 섹션 신규 — 동일 결정 cross-reference.

### 2. 구현
- `codebase/frontend/src/components/llm-config/model-combobox.tsx`
  - `<Input list>` → `<NativeSelect>` 전환.
  - 모델 미로드 + 저장된 값 없음 → disabled.
  - 편집 흐름에서 저장된 모델 ID 가 로드된 목록에 없을 경우: "현재 저장값: <id>" placeholder option 으로 유지 (호환).
  - 컴포넌트 명 `ModelCombobox` 유지 (호출자 영향 최소화).
- `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx`
  - 동일 패턴. "모델 불러오기" 버튼 신설 (현재는 페이지 로드 시 자동 fetch 만).
  - Disabled 정책 / 저장값 호환 정책 동일.

### 3. i18n
- `llmConfigs.loadModelsHint` / `embeddingModelHint` — "직접 입력" 표현 제거.
- 새 키 필요 시 ko/en parity 동시 추가.

### 4. 테스트
- `model-combobox.test.tsx` 의 "allows direct typing" 케이스 삭제 + select 케이스로 교체.
- 새 케이스:
  - 모델 미로드 상태에서 select disabled
  - 로드 후 옵션 노출
  - 편집 흐름에서 저장된 ID 가 옵션에 없으면 placeholder option 으로 표시
  - 옵션 선택 시 onChange 호출
- 임베딩 combobox 도 유사 케이스 추가.

## TEST 계획
lint → unit (frontend) → build (frontend) → e2e (LLM 설정·KB 설정 흐름 stub 영향만 — 기존 e2e 가 자유 입력 의존하지 않으면 기존 케이스 유지)

## REVIEW 계획
`/ai-review` 호출 후 SUMMARY 처리.
