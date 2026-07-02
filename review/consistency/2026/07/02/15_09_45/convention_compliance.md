# 정식 규약 준수 검토 — `spec/5-system/4-execution-engine.md`

검토 모드: --impl-done (diff-base `origin/main`)
대상 코드 변경: `resume-state.schema.ts` (zod `z.custom<T>()` enrich), `ai-turn-executor.ts` (`resumeState` 좁히기로 domain 캐스트 제거)

## 발견사항

검토 결과 CRITICAL/WARNING 없음.

- **[INFO]** target spec 문서 자체는 이번 diff로 변경되지 않음
  - target 위치: `spec/5-system/4-execution-engine.md` 전체
  - 위반 규약: 해당 없음 (정보성)
  - 상세: `git diff origin/main...HEAD -- spec/5-system/4-execution-engine.md` 결과가 비어 있다. 이번 변경은 `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 와 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 두 파일에 한정된 순수 리팩터링(zod 스키마 타입 sharpening, `as ChatMessage[]`/`as PresentationPayload[]` 류 domain 캐스트 제거)이며, spec frontmatter 의 `code:` glob (`codebase/backend/src/modules/execution-engine/**`)에 포함되는 정상 범위다. spec 텍스트 갱신 의무가 발생하는 "새 계약·새 필드·새 상태" 도입이 아니므로 spec-sync 누락이 아니다.
  - 제안: 조치 불필요. 참고로 스키마 파일 주석이 `spec/5-system/4-execution-engine.md §1.3, impl-prep I-8`, `§7.5 graceful-reset`, `#783` 을 명시적으로 인용해 spec↔코드 추적성을 스스로 유지하고 있어 바람직하다.

- **[INFO]** `z.custom<T>()` 사용이 "런타임 미검증" 계약과 정합적으로 문서화됨
  - target 위치: `spec/5-system/4-execution-engine.md` §1.3 (라이프사이클 구분: `ResumeState`/`ResumeCheckpoint`/`RetryState`), §7.5 (rehydration graceful-reset)
  - 위반 규약: 없음 — 확인 목적의 INFO
  - 상세: `resume-state.schema.ts` 최상단 주석은 "본 스키마는 런타임 경계에서 parse/safeParse 하지 않는다" 는 기존 계약을 그대로 유지한다고 명시하고, `z.custom<ChatMessage>()`/`z.custom<unknown[]>()`/`z.custom<PresentationPayload[]>()` 도입이 "모든 값 통과 — 타입만 sharpen" 이라는 점을 diff 주석(`M-7 enrich`)에서 재확인한다. `z.array(z.custom<T>())` 는 배열 여부만 검사해 기존 `z.array(z.unknown())` 와 동일한 런타임 강도라는 설명도 spec §7.5 "malformed 허용 semantics" 서술과 어긋나지 않는다. conventions 디렉토리에 zod 스키마 전용 정식 규약 문서는 존재하지 않으나(`spec/conventions/**` grep 결과 없음), 이 코드 주석 수준의 자기 문서화가 그 공백을 사실상 메우고 있어 규약 위반으로 볼 근거가 없다.
  - 제안: 없음. 다만 향후 zod 스키마가 늘어나면 `spec/conventions/` 에 "런타임 미검증 스키마(z.custom/z.unknown 용도)" 패턴을 명문화하는 것을 고려할 수 있다(선택 사항, 이번 변경 자체의 결함 아님).

- **[INFO]** frontmatter/문서 구조 규약 위반 없음
  - target 위치: `spec/5-system/4-execution-engine.md` 1~14행 frontmatter
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §1 (lifecycle frontmatter), CLAUDE.md 문서 구조 규약(Overview/본문/Rationale)
  - 상세: `id: execution-engine`, `status: partial`, `code:` 배열, `pending_plans:` 모두 정상 형식이며 Overview(22행)/본문(§1~§11)/Rationale(1238행~) 3섹션 구조를 그대로 유지하고 있다. 이번 diff 는 이 구조에 아무 영향을 주지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 명명 규약 대상 외 영역
  - target 위치: 코드 diff 전체 (`resume-state.schema.ts`, `ai-turn-executor.ts`)
  - 위반 규약: `spec/conventions/audit-actions.md`, `spec/conventions/error-codes.md`, `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/migrations.md` 등 명명 규약 문서들
  - 상세: 위 conventions 문서들은 각각 audit action 문자열, 에러 코드 어휘, Cafe24 API 카탈로그, DB 마이그레이션 명명을 다루며 이번 diff(zod 스키마 타입·in-memory 변수명 `resumeState`)와 도메인이 겹치지 않는다. 새 API endpoint, 새 이벤트 페이로드, 새 에러 코드, 새 DTO 도입이 없어 API 문서 규약(OpenAPI/Swagger 데코레이터·DTO 명명) 관점도 해당 없음.
  - 제안: 조치 불필요.

## 요약

이번 diff(`resume-state.schema.ts` 의 `z.custom<T>()` enrich + `ai-turn-executor.ts` 의 `resumeState` 좁히기)는 target spec(`spec/5-system/4-execution-engine.md`)의 텍스트를 전혀 변경하지 않는 순수 내부 타입 정제 리팩터링이며, 코드 주석이 관련 spec 섹션(§1.3, §7.5)과 이전 PR(#783)을 명시적으로 인용해 "런타임 미검증" 계약을 그대로 보존한다고 스스로 문서화하고 있다. `spec/conventions/**` 어느 문서(명명·출력 포맷·문서 구조·API 문서·금지 항목)와도 직접 충돌하는 지점이 없으며, frontmatter/3섹션 구조도 정상이다. 정식 규약 준수 관점에서 지적할 CRITICAL/WARNING 사항은 없다.

## 위험도

NONE
