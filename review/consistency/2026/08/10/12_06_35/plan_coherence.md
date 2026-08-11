# Plan 정합성 검토 — `spec/7-channel-web-chat/2-sdk.md`

## 검토 방법

`plan/in-progress/**` 전수 중 target(`2-sdk.md`) 또는 그 직접 인접 문서(`3-auth-session.md`,
`4-security.md`, `1-widget-app.md`)를 참조하는 plan 을 식별해 개별 대조했다. 번들이 예산 초과로
절단한 항목 중 `2-sdk.md`/`channel-web-chat` 를 언급하는 3건
(`webchat-command-failure-is-not-termination.md`, `webchat-boot-apibase-scheme-validation.md`,
`webchat-spec-rationale-followup.md`)은 저장소에서 직접 `Read` 해 보강했다. 나머지 절단분(53개)은
target 과 무관한 도메인(cafe24/AI Agent/marketplace/node-output-redesign/harness 인프라 등)임을
grep 으로 확인했다.

## 발견사항

- **[INFO]** `spec-update-webchat-evidence-pointers.md` 는 완료됐으나 plan frontmatter 가 여전히 `in-progress`
  - target 위치: `2-sdk.md` frontmatter `code:` 목록 (L21-L41), 특히 L26-L41 인라인 주석
  - 관련 plan: `plan/in-progress/spec-update-webchat-evidence-pointers.md` §제안 (전 항목 `[x]`) · §결정("지금 고친다", 2026-08-10)
  - 상세: 이 plan 이 제안한 3가지(①`use-session-generations.ts` 를 `code:` 에 추가 ②세 파일의 역할을 가르는 인라인 주석 ③`3-auth-session.md` 쪽 동일 추가)가 target 에 **정확히 반영**돼 있다. 즉 target 은 이 plan 의 산출물이며 내용 충돌은 없다. 다만 plan 파일 자체의 frontmatter `status` 가 `in-progress` 로 남아 있고, 체크리스트 3항목이 모두 `[x]` 인데도 완료 이동(lifecycle) 마커가 없다.
  - 제안: 코드/spec 정합에는 조치 불요. plan 라이프사이클 관점에서 `spec-update-webchat-evidence-pointers.md` 를 `plan/complete/` 로 이동하거나 status 갱신을 검토할 것(본 checker 범위 밖의 housekeeping 이라 WARNING 아닌 INFO 로 기록).

- **[INFO]** 다음 `useWidget` slice 착수 시 `code:` 목록 재갱신이 필요함을 양쪽 문서가 이미 정합되게 기록
  - target 위치: `2-sdk.md` L36-L38 ("심볼을 옮길 때 이 목록도 함께 옮길 것")
  - 관련 plan: `plan/in-progress/webchat-usewidget-extraction.md` §남은 slice(L470-L474), §"다음 slice 담당자에게"(L323-L324, `spec-update-webchat-evidence-pointers.md` 내)
  - 상세: `webchat-usewidget-extraction.md` 는 `applyConfig`/`start`/`teardownSession` 등 나머지 로직이 `use-session-generations.ts` 밖(추후 `useEiaSession` 또는 별도 훅)으로 더 옮겨갈 수 있음을 명시하고 있고, 이 경우 `2-sdk.md`(및 `3-auth-session.md`)의 `code:` 증거 포인터가 다시 stale 해진다. target 의 인라인 주석이 이미 이 위험을 명문화해 다음 담당자에게 알림 역할을 하고 있어 **선행 plan 미해소가 아니라 이미 추적된 상태**다. 새 조치 불요, 확인 차 기록.
  - 제안: 없음(교차 확인 목적의 기록).

- 검토했으나 충돌 없음으로 판정한 미해결 결정 2건:
  - `webchat-command-failure-is-not-termination.md` (비-410 명령 실패를 종료로 볼지 A/B/C 미결) — target 의 `wc:event conversationEnded.data.reason` 서술(§3, L135)은 "열린 문자열" 로만 정의하고 SSE terminal/`user_ended`/`gone` 예시만 들 뿐, 명령 실패를 종료 사유로 포함하거나 배제하지 않는다. A/B/C 어느 결정이 내려져도 이 서술과 충돌하지 않는다.
  - `webchat-boot-apibase-scheme-validation.md` (`wc:boot` 경로 `apiBase` 스킴 검증 여부 미결) — target §3 "wc:boot 재전송"(L142-L148)은 apiBase 변경 시 세션 폐기·재시작만 서술하고 스킴 검증에 대해서는 아무 주장도 하지 않는다. 검증을 적용하든 안 하든 target 서술과 무관.

- 교차 검증(참고): `webchat-spec-rationale-followup.md` 가 "2026-08-10 완료" 로 표시한 항목들(`2-sdk.md §3` apiBase 예외 각주, `3-auth-session.md §R7`/`§R8`, `4-security.md` 재전송-origin 위협 표 행)을 실제 파일에서 확인 — 전부 존재하며 target 서술(L145 "예외 — `apiBase` 가 바뀐 재부팅...")과 정합. 플랜의 완료 주장이 사실과 일치한다.

## 요약

`spec/7-channel-web-chat/2-sdk.md` 는 관련 `plan/in-progress/**` 전체와 정합적이다. 이 문서를 직접 겨냥한 plan(`spec-update-webchat-evidence-pointers.md`, `webchat-spec-rationale-followup.md`)의 제안·완료 주장은 모두 target 에 정확히 반영돼 있고, 아직 미결인 두 제품 결정(비-410 명령 실패 처리, `wc:boot` apiBase 스킴 검증)은 target 이 그 어느 방향으로도 선점하거나 우회하지 않아 CRITICAL 성격의 충돌이 없다. 발견한 두 건은 모두 housekeeping/추적 성격의 INFO 로, 실제 조치가 급한 것은 없다.

## 위험도

LOW
