# Rationale 연속성 검토 결과

## 스코프 확인 (분석 절차 기록)

target 은 `spec/7-channel-web-chat` 전체 번들로 제공됐으나, 실제 diff(`git diff origin/main`)를 절대경로 워크트리에서
직접 확인한 결과 코드/spec 변경은 다음으로 한정된다:

- `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` → `embed-config-response.dto.ts` **파일명 rename**
  (클래스명 `EmbedConfigDto` 는 무변경, 내용도 무변경 — `git mv` + import 경로 1곳 갱신).
- `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 경로 1줄 동기화 (강제 path mirror).
- `plan/in-progress/embed-config-dto-rename.md` 신규(작업 기록).
- `plan/complete/spec-draft-pr874-deferred-docs.md` → `plan/in-progress/...`로 되돌아간 것처럼 보이는 diff는 **본 작업과
  무관한 diff-base 문제**다: 본 워크트리의 fork-point(`84b1ea635`) 이후 origin/main 에 별도 PR #925
  (`chore(plan): mark spec-draft-pr874-deferred-docs complete`)이 랜딩해 그 완료 처리를 앞질러 반영했을 뿐이며,
  본 브랜치가 그 plan 문서를 실제로 되돌린 사실이 없다(rebase 시 사라질 diff). spec Rationale 과 무관하므로 본
  검토의 발견사항에서 제외한다.

spec/7-channel-web-chat 본문·Rationale 절 자체는 이번 변경으로 전혀 수정되지 않았다(frontmatter `code:` 경로 1줄만).
따라서 이번 diff 가 재도입/번복/원칙위반을 일으킬 표면이 거의 없다.

## 발견사항

없음 (CRITICAL/WARNING 0건).

### [INFO] DTO rename 은 기존 합의 위반이 아니라 conformance 이행

- target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `code:` (파일 경로 갱신 1줄)
- 과거 결정 출처: `spec/conventions/swagger.md` §5-1 "응답 DTO 위치 — `*-response.dto.ts`" (기존 규약, 본 diff 이전부터 확정)
- 상세: `embed-config.dto.ts` 는 `dto/responses/` 36개 중 유일하게 §5-1 파일명 패턴을 미준수하던 사전 결함이며,
  `review/consistency/2026/07/12/01_41_42/` 검토가 발견한 항목을 이번에 그대로 정합화했다. §5-1 은 **파일명**만
  규정하고 클래스명은 규정하지 않으며, 실제 sibling 파일 33개 표본 확인 결과 `FolderDto`/`EdgeDto`/`ScheduleDto`/
  `WorkflowDto`/`ModelConfigDto`/`WebhookInteractionDto`/`AuthConfigDto`/`ExecutionDto` 등 다수가 `*Dto`(Response
  접미사 없음) 패턴이라, 클래스명 `EmbedConfigDto` 를 유지한 이번 결정은 실제 코드베이스 관례와 정합한다.
  한편 완료된 `plan/complete/webchat-polish-batch.md` 의 deferred 메모는 한때 "`EmbedConfigResponseDto` 로도 리네임"을
  언급했으나, 이는 spec `## Rationale` 에 박힌 결정이 아니라 비공식 followup 메모였고, 이번 plan
  (`plan/in-progress/embed-config-dto-rename.md` "컨벤션 재확인" 절)이 §5-1 원문·sibling 관례를 재확인해 파일명만
  정정하고 클래스명은 보존하기로 명시적으로 재판단했다 — 이는 "무근거 번복"이 아니라 근거를 재확인한 의도적 축소
  범위(scope reduction)이며, 그 판단 근거가 plan 문서에 기록되어 있어 추적 가능하다.
- 제안: 조치 불필요. 다만 향후 유사 followup 메모(비공식 "다음엔 이렇게" 제안)를 실제 결정 확정 전 spec Rationale 로
  승격하지 않은 채 방치하면, 이번처럼 "메모와 다르게 구현"이 매번 재검증 부담을 만든다 — 클래스명 규약을 확정할
  의향이 있다면 swagger.md §5-1 에 "클래스명은 규정하지 않음(파일명 전용 규약)"을 한 줄 명문화해 두면 향후 동일
  재검증 반복을 줄일 수 있다(선택 사항, 비차단).

## 요약

이번 diff 는 `spec/7-channel-web-chat`(및 관련 EIA·webhook·conversation-thread·swagger 등 인접 spec)의 `## Rationale`
에서 기각된 대안을 재도입하거나, 합의된 설계 원칙(예: R2 client-consumer 한정, R5 정적 CDN 자산, R9 single-flight
coalesce, EIA-IN-02 매핑 등)을 위반하는 지점이 없다. 실질 변경은 기존 합의된 파일명 규약(swagger.md §5-1)을 뒤늦게
준수시키는 순수 rename 이며, 관련 spec 본문·Rationale 텍스트 자체는 건드리지 않았다(frontmatter 경로 미러 1줄만
갱신). `plan/` 하위에서 보이는 완료 plan 되돌림처럼 보이는 diff 는 fork-point 이후 origin/main 에 별도로 랜딩한
plan 라이프사이클 커밋(#925)과의 diff-base 불일치이며 본 작업이 실제로 만든 변경이 아니다.

## 위험도

NONE
