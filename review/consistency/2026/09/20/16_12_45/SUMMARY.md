# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 전문 확보(모두 `success`), 재시도 필요 항목 없음.

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 1건(리다이렉트 홉 에러 코드가 챗 채널 사용자 메시지 규약과 충돌하는 cross-spec 파급, 구현 사실 자체는 정확)과 INFO 8건(대부분 이전 차수부터 이월된 비차단 참고사항). target(`plan/in-progress/spec-draft-integration-error-facts.md`)이 손대는 4개 spec 파일 자체의 내부 정합은 CRITICAL 0·WARNING 0으로 이미 수렴했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 리다이렉트 홉 SSRF 가드 고장이 `HTTP_TRANSPORT_FAILED`로 라우팅된다는 신규 서술이, 그 코드를 이미 "정상적인 외부 서비스 실패"로 분류해 사용자에게 노출하는 챗 채널 메시징 규약과 충돌 — 내부 SSRF 가드 결함이 사용자에게 "외부 서비스 문제"로 오안내되는 경로를 이 draft가 처음으로 문서 표면에 드러냄 | 변경안 ②, `1-http-request.md §4 step 8` 끝 추가 문장("step 9의 리다이렉트 홉에서 같은 고장이 나면 전송 catch로 떨어져 `HTTP_TRANSPORT_FAILED`가 된다") | `spec/conventions/chat-channel-adapter.md §3.1` 카테고리 매핑 표(`HTTP_TRANSPORT_FAILED`→`executionFailedThirdParty`) + `spec/5-system/15-chat-channel.md` "언어 힌트"(사용자 문구 "외부 서비스 응답을 받지 못했습니다") | `1-http-request.md`의 새 문장 뒤 또는 `0-common.md §4.2`에 "리다이렉트 홉의 가드 고장이 `HTTP_TRANSPORT_FAILED`로 합류하는 것은 챗 채널 사용자 메시지(`executionFailedThirdParty`)에서 내부 오류를 외부 서비스 탓으로 오분류한다 — 두 시점 코드 통일 여부를 정할 때 이 파급도 함께 검토" 포인터 한 줄 추가, 또는 트래커의 열린 항목(코드 통일 여부) 서술에 이 파급을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | MakeShop 연결 테스트가 노드 런타임과 동일 코드(`MAKESHOP_AUTH_FAILED`)를 재사용 — "연결 테스트 코드는 별도 namespace" 관례의 유일한 비-호스트차단 예외 | 변경안 ④, `2-navigation/4-integration.md §5.9` | 이번 스코프 밖. 후속으로 Rationale "코드 이름" 문단이나 §14.1 표에 "MakeShop은 인증 실패에도 노드/테스트 코드를 분리하지 않는다" 한 구를 트래커에 남길 것 |
| 2 | cross_spec | `5-system/3-error-handling.md §1.4` 공용 카탈로그의 HTTP/DB 행에 `INTEGRATION_*` 계열이 아예 없어, 이번에 4개 문서에 채우는 상세가 이 5번째 문서엔 반영 안 됨 | 변경안 ②③ 전체 | spec_impact 스코프 밖(비-망라 카탈로그이므로 직접 모순 아님). 트래커에 "3-error-handling.md §1.4 HTTP/DB 행에 INTEGRATION_* 추가" 후속 항목으로 남기는 정도로 충분 |
| 3 | rationale_continuity | §8.3(2026-07-05)·`DB_HOST_BLOCKED` Rationale(2026-06-12)이 "판정 vs 가드의 고장" 구분이 생기기 전 문장이라, 신규 추가문과 나란히 읽으면 옛 버그 재발처럼 오독될 여지(내용상 모순은 없음 — 신규 문장에 "차단 판정이 아니면" 한정어 존재) | 변경안 ②, `1-http-request.md §4`/`2-database-query.md §6.2` 신설 문장 | §8.3 또는 신설 문장에 "(§8.3의 redirect SSRF 차단→`HTTP_BLOCKED`는 판정에 한정되며, 가드 자체의 고장은 본 항목이 다룬다)" 한 구 추가 권장(강제 아님) |
| 4 | convention_compliance | `INTEGRATION_AUTH_UNSUPPORTED` 신규 행의 §14.1 표 내 삽입 위치(공통군 블록 vs HTTP 블록) 미명시 | 변경안 ③ 두 번째 불릿 | 반영 시 `INTEGRATION_INCOMPLETE` 행(L1107) 바로 아래에 삽입해 같은 `resolveHttpCredentials` 출처 코드 둘을 붙이도록 draft에 한 줄 명시 권장 |
| 5 | convention_compliance | review-citations.md 관점에서 draft가 트래커 경로를 backtick 코드로 처리(마크다운 링크 미사용)한 것은 이미 규약을 정확히 회피한 선례 — 문제 아니라 참고용 긍정 기록 | 변경안 ②(`--spec` 2차 W2) | 조치 불요. 향후 유사 draft의 참고 선례로 남김 |
| 6 | plan_coherence | 리다이렉트 홉의 `HTTP_TRANSPORT_FAILED` 행 문구가 "가드의 고장" 트리거를 여전히 명시적으로 담지 않음(1차 CRITICAL → 2차·3차 INFO로 이월, 이번 개정에도 미반영) | 변경안 ②, `1-http-request.md:337` `HTTP_TRANSPORT_FAILED` 행 | `## 비대상` 또는 트래커 4944행에 "코드 통일 여부와 별개로 행 문구에 트리거 추가도 그때 함께 처리" 구절 남길 것 — 없으면 착수자가 "코드도 문서도 그대로"로 오독 가능 |
| 7 | plan_coherence | `1-http-request.md` frontmatter `code:` 편입이 `http-safety.ts` 이동 계획(트래커, open)과 예정된 재작업으로 다시 부딪힘 — 충돌 아니라 예정된 재작업 | 변경안 ① frontmatter `code:` | 별도 조치 불요. 이동 항목 실행자가 그 시점에 `http-redirect.ts`·`http-credentials.ts`도 재조정 범위임을 인지하면 충분 |
| 8 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md`)의 `spec_impact` 목록에 이번 target이 건드리는 4개 spec 파일이 없음 — target이 만든 문제 아닌 사전 존재 갭 | 해당 없음(target 자신의 `spec_impact`는 4개 파일 정확 열거) | target 완료 후 트래커 4975·4993행을 `[x]` 처리하며 자연 소멸. 남은 4944행(가드 고장 시점 통일 미결정) 처리 시 같은 파일 재편입 필요성 판단 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 리다이렉트 홉 오류 코드가 챗 채널 사용자 메시지 규약과 충돌(WARNING 1) + INFO 2(MakeShop 코드 미분리, 5번째 카탈로그 비대칭) |
| rationale_continuity | LOW | 옛 Rationale이 "판정/고장" 구분 이전 문장이라 신규 문구와 나란히 읽을 때 오독 여지(INFO 1) — 실질 번복·모순 없음 |
| convention_compliance | NONE | 정식 규약 위반 없음. 표 삽입 위치 미명시(INFO), review-citations 선례 기록(INFO) |
| plan_coherence | LOW | 1차 CRITICAL(열린 결정 선취)은 실측표로 해소됨. 잔여 INFO 3건 모두 비차단(행 문구 미보강 이월, frontmatter 재작업 예고, 트래커 spec_impact 사전 갭) |
| naming_collision | NONE | 신규 식별자 전무 — 기존 코드/파일의 사실 반영만 |

## 권장 조치사항
1. (필수 아님, BLOCK 사유 아님) WARNING 1건 — `1-http-request.md`의 리다이렉트 홉 신설 문장 또는 `0-common.md §4.2`에, 해당 코드 합류가 챗 채널 `executionFailedThirdParty` 사용자 메시지를 오분류시킨다는 포인터 한 줄을 추가하거나 트래커의 "코드 통일 여부" 열린 항목에 이 파급을 명시할 것을 권장.
2. INFO 8건은 모두 이번 draft 반영을 막을 사유가 아니며, 대부분 트래커(`spec-draft-nullable-notation-followups.md`)의 후속 항목으로 남기는 것으로 충분.
3. target은 현재 형태로 반영 가능(BLOCK: NO). 반영 후 트래커 4975·4993행 체크박스를 `[x]` 처리할 것.
