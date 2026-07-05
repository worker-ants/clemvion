# Plan 정합성 검토 — spec/4-nodes/4-integration/

검토 모드: --impl-done (구현 완료 후, diff-base=origin/main)

## 발견사항

- **[WARNING] 선행 plan(`http-ssrf-all-auth-followups.md`)의 완료된 항목이 체크박스 미갱신 상태로 남음**
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` §8.3 "SSRF 차단 메시지 일반화 — 정찰 면 축소 (2026-07-05)", §4 step 8/9, §5.3, §6
  - 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` §코드 첫 항목 (라인 14) — "**SSRF 에러 메시지 클라이언트 일반화**: `http-safety.ts` 의 `SSRF_BLOCKED: hostname "..."` 메시지가 차단 host/IP 를 `output.error.message` 로 노출(정찰 면). 클라이언트엔 일반화("Request blocked by SSRF policy"), 상세는 서버 로그 — 단 http-safety 는 HTTP/DB/Email 공용이라 3노드 영향 audit 동반." — 여전히 `[ ]` (미체크)
  - 상세: 실제 diff(`origin/main..HEAD`)를 확인한 결과 이 항목이 정확히 구현됐다. `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` 에 `SSRF_BLOCKED_CLIENT_MESSAGE = 'Request blocked by SSRF policy.'` 상수가 추가되고, preflight SSRF 차단·redirect 홉 SSRF 차단 양쪽 모두 `logger.warn` 으로 원본 상세를 서버 로그에만 남기고 `output.error.message` / usage 로그 message 는 일반화 문구로 대체됐다(target spec §8.3 이 정확히 이 내용을 문서화). target spec 은 `2-database-query.md` Rationale 도 함께 갱신해 "HTTP Request(`HTTP_BLOCKED`)도 2026-07-05 동일 일반화 완료" 로 forward-reference 를 완료 참조로 바꿔두었다 — spec 쪽은 내적으로 정합하다. 그러나 이 작업의 근거가 된 plan 파일 자체의 체크박스는 여전히 `[ ]` 로 남아 있어, plan 문서만 보면 이 항목이 아직 미해결로 보인다. 이 프로젝트의 관례(같은 파일의 다른 항목들 — `HTTP_BLOCKED enum 참조화`, `DB_HOST_BLOCKED 신설` 등 — 은 모두 `[x] ... **(완료, PR ...)**` 패턴으로 커밋되어 있음)에 비춰보면 이는 갱신 누락이다.
  - 제안: 구현 커밋에 `plan/in-progress/http-ssrf-all-auth-followups.md` 라인 14 를 `[x]` 로 갱신하고 완료 근거(PR/커밋 `ea09f1d7f`, `d12ef7594` 또는 최종 PR 번호, target spec §8.3 앵커)를 부기할 것. 다른 완료 항목들과 동일한 서술 패턴을 따를 것.

- **[INFO] plan 이 명시한 "http-safety 는 HTTP/DB/Email 공용이라 3노드 영향 audit 동반" 캐비어트는 이번 diff 범위에서 의도적으로 HTTP 단독으로 좁혀졌으며, 이는 타당함**
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` §8.3
  - 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` 라인 14 후반부 "단 http-safety 는 HTTP/DB/Email 공용이라 3노드 영향 audit 동반"
  - 상세: diff 를 확인한 결과 `codebase/backend/src/nodes/integration/http-request/http-safety.ts`(3-node 공유 유틸)·`database-query` 핸들러·`send-email` 핸들러는 이번 커밋에서 전혀 수정되지 않았다(`git diff origin/main --stat` 상 해당 경로 변경 없음). 이는 plan 이 요구한 "3노드 영향 audit" 를 이번 PR 이 수행하지 않았다는 뜻일 수도 있으나, target spec 자체를 보면 DB Query(`DB_HOST_BLOCKED`)·Send Email(`EMAIL_HOST_BLOCKED`) 은 **이미 이전 PR 에서** 메시지 일반화가 완료돼 있었고(각 spec 의 기존 Rationale 이 이를 명시), 이번 작업은 그 비대칭의 마지막 조각인 HTTP 만 좁혀서 마무리한 것으로 읽힌다. 즉 "3노드 audit" 의 실질 — 세 노드 모두 host/IP 미노출 메시지를 갖는 상태 — 은 이번 변경 이후 달성됐다(HTTP 는 핸들러 레벨 message override, DB/Email 은 기존 구현). `http-safety.ts` 자체(원본 예외 메시지)를 손대지 않은 것은 핸들러 레벨에서 catch 후 override 하는 패턴을 그대로 따른 것이라 설계상 문제는 아니다.
  - 제안: 별도 조치 불요. 단, 위 WARNING 의 plan 체크박스 갱신 시 "3노드 audit" 문구를 "HTTP 는 핸들러 레벨 override 로 완료, DB/Email 은 기존 구현으로 이미 충족" 식으로 구체화해 두면 향후 재확인 비용을 줄일 수 있다.

- **[INFO] `spec-sync-integration-common-gaps.md` 는 이번 target 변경과 무관**
  - target 위치: `spec/4-nodes/4-integration/0-common.md` (frontmatter `pending_plans`)
  - 관련 plan: `plan/in-progress/spec-sync-integration-common-gaps.md` (⚠ Missing integration 배지 아키텍처 결정, 미확정)
  - 상세: 이번 diff 는 `0-common.md` 를 직접 수정하지 않았고(`1-http-request.md`/`2-database-query.md`/`2-navigation/4-integration.md`/`5-system/2-api-convention.md` 만 변경), 이 plan 이 다루는 배지 이슈와도 무관하다. 미해결 결정과의 충돌 없음.
  - 제안: 조치 불요.

## 요약

이번 구현(HTTP Request SSRF 차단 메시지 일반화, §8.3)은 선행 plan `plan/in-progress/http-ssrf-all-auth-followups.md` 가 명시한 유일한 미해결 코드 항목("SSRF 에러 메시지 클라이언트 일반화")을 정확히 이행했고, `2-database-query.md` Rationale 의 forward-reference 도 완료 참조로 함께 갱신해 spec 내적 정합성은 확보됐다. 그러나 그 근거가 된 plan 파일 자체의 체크박스는 여전히 `[ ]` 로 남아 있어 — 이 프로젝트가 관례적으로 지키는 "완료 시 `[x]` + 근거 기록" 패턴에서 벗어난 갱신 누락이다. 미해결 결정을 우회하거나 다른 plan 의 전제를 무효화하는 CRITICAL 성격의 충돌은 발견되지 않았다.

## 위험도

MEDIUM
