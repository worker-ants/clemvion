# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

**리뷰 일시**: 2026-05-22
**검토 대상**: AI Agent `render_*` presentation tool family 구현 PR

---

## 매트릭스 적재 결과

`PROJECT.md` §변경 유형 → 갱신 위치 매핑 표를 읽어 SoT 로 적재했습니다.
관련 trigger 항목 수: 전체 12개 중 3개가 이번 변경 set 에 매칭됩니다.

---

## 발견사항

### 발견 없음 (ALL PASS)

아래 각 trigger 에 대해 순서대로 검토한 결과, 동반 갱신 누락이 없습니다.

---

#### Trigger 1: 노드 schema 변경 (필드 추가)

- **변경 파일**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`
- **변경 내용**: `presentationTools: PresentationToolDef[]` 필드 신규 추가, `presentationToolDefSchema` 신규 정의, `validateAiAgentConfig` 에 중복 type 검증 추가
- **매트릭스 항목**: "노드 schema 변경 (필드 추가·라벨 변경)" → (a) `02-nodes/<cat>.mdx` FieldTable, (b) `dict/{ko,en}/<section>.ts` 해당 키, (c) `backend-labels.ts` label/errorCode
- **검토 결과**:
  - (a) `codebase/frontend/src/content/docs/02-nodes/ai.mdx` — `presentationTools` FieldTable 행 추가, `### Presentation Tools` 전용 섹션 신설 (KO) **완료**
  - (a) `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` — 동일 섹션 EN 버전 신설 **완료**
  - (b) `codebase/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts` — `presentationToolsGroup`, `presentationToolsHint`, `presentationToolLabel`, `presentationToolType`, `presentationToolTypeTable/Chart/Carousel/Template/Form`, `presentationToolDescription`, `presentationToolDescriptionPlaceholder`, `presentationToolDefaults`, `presentationToolDefaultsHint`, `addPresentationTool` 14개 키 추가 **완료**
  - (b) `codebase/frontend/src/lib/i18n/dict/en/nodeConfigs.ts` — 동일 14개 키 EN 버전 추가 **완료**
  - (c) 신규 `ErrorCode` enum 추가 없음, 신규 `warningRules` 추가 없음 (`render-tool-provider.ts` 의 에러 반환은 tool_result content 내 JSON 이며 `ErrorCode` enum 과 무관). `backend-labels.ts` 갱신 불필요 **확인**

---

#### Trigger 2: i18n parity (신규 UI 문자열 TSX)

- **변경 파일**: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` (신규)
- **매트릭스 항목**: "신규 UI 문자열 (TSX)" → `dict/{ko,en}/<section>.ts` 양쪽 등록 필수
- **검토 결과**: 해당 파일 내 사용자에게 노출되는 문자열은 `"render_"` + `p.type` (동적 영문 조합), `"truncated · total"` (영문 리터럴) 등 모두 영문입니다. 한국어 하드코딩 리터럴이 없으며 dict 키를 통한 `useT` 호출도 없습니다. 이 컴포넌트는 디버그/개발자 지향 메타정보 표시 용도로, 한국어 리터럴을 추가하지 않은 것이 의도된 설계입니다. parity 위반 없음 **확인**
- **참고**: `presentation-renderers.tsx` 에서 5개 컴포넌트가 `export` 로 공개 변경됐으나 새 한국어 리터럴 추가는 없습니다.

---

#### Trigger 3: 관련 docs MDX (프레젠테이션 노드 문서)

- **변경 파일**: `codebase/frontend/src/content/docs/02-nodes/presentation.mdx`, `presentation.en.mdx`
- **매트릭스 항목**: "노드 schema 변경 / 통합 변경" 에서 sibling `.en.mdx` 동반 갱신
- **검토 결과**: `presentation.mdx` (KO) 에 `## AI 도구 모드 (Presentation Tools)` 섹션 추가 + `presentation.en.mdx` (EN) 에 `## AI tool mode (Presentation Tools)` 섹션 추가. 양쪽 모두 갱신 **완료**

---

#### 미해당 trigger 확인

| Trigger | 판정 | 근거 |
|---|---|---|
| 새 노드 추가 | 해당 없음 | 기존 `ai-agent` 노드 schema 확장이며 신규 노드 디렉토리 생성 아님 |
| 신규 warningCode 발행 | 해당 없음 | `warningRules` 변경 없음 |
| 신규 errorCode 발행 | 해당 없음 | `ErrorCode` enum 변경 없음. `render-tool-provider.ts` 의 에러 처리는 tool_result 내 JSON 으로 backend-labels 매핑 대상 아님 |
| 유저 가이드 신규 섹션 디렉토리 | 해당 없음 | `<NN>-<name>/` 형태의 신규 섹션 디렉토리 없음 |
| 인증·권한·세션 흐름 변경 | 해당 없음 | `auth/` 또는 세션 미들웨어 변경 없음 |
| 표현식 언어 변경 | 해당 없음 | `packages/expression-engine` 변경 없음 |
| 실행·디버깅 흐름 변경 | 해당 없음 | 실행 엔진 코어 변경 없음. `conversation-thread.service.ts` 변경은 프레젠테이션 페이로드 첨부 로직으로 `05-run-and-debug/` 갱신 대상 아님 |
| 통합 신규/제공자 변경 | 해당 없음 | `06-integrations-and-config/` 관련 provider 변경 없음 |

---

## 요약

PROJECT.md §변경 유형 → 갱신 위치 매핑 표의 12개 trigger 중 3개가 이번 변경 set 에 매칭됩니다. 매칭된 trigger 모두에 대해 동반 갱신이 완료된 것을 확인했습니다: (1) `ai-agent.schema.ts` 의 `presentationTools` 필드 추가에 대한 `ai.mdx`/`ai.en.mdx` FieldTable 및 `### Presentation Tools` 섹션 갱신 완료, (2) `dict/ko/nodeConfigs.ts` + `dict/en/nodeConfigs.ts` 양쪽 parity 14개 키 동시 추가 완료, (3) `presentation.mdx`/`presentation.en.mdx` AI 도구 모드 섹션 신설 완료. 신규 TSX 한국어 하드코딩 없음, 신규 ErrorCode/warningCode enum 추가 없음. 누락 발견사항 0건.

---

## 위험도

NONE
