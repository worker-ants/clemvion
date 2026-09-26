# Plan 정합성 검토 — success-advert (`--impl-done`)

## 검토 방법

`plan/in-progress/**` 번들이 예산 초과로 전량(68개 파일) 절단되어, 아래 파일을 절대경로로
직접 Read 하여 대조했다: `plan/in-progress/success-advert.md`(구현 plan 본체),
`plan/in-progress/spec-draft-swagger-success-advert.md`(선행 planner draft),
`plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커, 해당 항목 및 주변 항목),
그리고 `swagger.md`/`http-status-advertised`/`api-wrapped`/`workflow-assistant` 키워드로 전체
`plan/in-progress/*.md` grep. 코드 diff(`_code_diff.patch`, 15파일)도 대조해 실제 변경 범위(응답
DTO·swagger 데코레이터·가드 강화뿐, 비즈니스 로직 무변경)를 확인했다.

## 발견사항

- **[INFO]** 선행 spec-draft plan 이 in-progress 로 남아 있음
  - target 위치: (plan 측) `plan/in-progress/spec-draft-swagger-success-advert.md` frontmatter `status: in-progress`
  - 관련 plan: 동일 파일 — 이 draft 의 네 가지 변경안(§2-4 문장, §5-2 래퍼 행, §5-4 체크리스트, Rationale 불릿)이 이미
    `spec/conventions/swagger.md`(라인 307, 467, 702 부근)에 그대로 반영되어 있음을 확인(planner 커밋 `24084fd0e`,
    `success-advert.md` 체크리스트 1행)
  - 상세: 내용은 완전히 반영되어 정합성 문제는 없으나, draft plan 자체의 `status`/lifecycle 정리(complete 이동 또는
    구현 plan 에 흡수)가 아직 안 됨 — 통상적 마무리 절차 누락일 뿐 충돌은 아니다
  - 제안: `success-advert.md` 의 남은 체크리스트(`--impl-done` · 트래커 항목 닫기) 완료 커밋에서 이 draft plan 도
    함께 `plan/complete/`로 이동하거나 구현 plan 에 병합 정리할 것

- **[INFO]** 트래커 항목이 아직 미종결 상태(정상 시퀀스)
  - target 위치: `spec/conventions/swagger.md` §2-4·§5-2 (이번 PR 이 반영한 결정)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5130` — "성공 응답을 광고하지 않는 라우트
    핸들러가 15곳 있다" 항목이 여전히 `[ ]`
  - 상세: `success-advert.md` 자체 체크리스트가 "트래커 항목 닫기"를 `--impl-done` **뒤**의 마지막 단계로 명시적으로
    순서화해 두었다 — 이 검토 시점(= `--impl-done` 진행 중)에 아직 미체크인 것은 계획된 시퀀스이지 누락이 아니다
  - 제안: 없음(그대로 진행). `--impl-done` 통과 후 트래커 체크 + 커밋 SHA 기록이 남은 유일한 조치

- **[INFO]** 인접 트래커 항목 두 건은 의도적으로 미해결 상태 유지(적절한 처분)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표(`revoke-token` 명명), `spec/3-workflow-editor/4-ai-assistant.md` §6 API 표
  - 관련 plan: `spec-draft-nullable-notation-followups.md:5118`(`sessions/latest` 가 §6 표에 없음), `:5124`(`revoke-token`
    을 trigger-list 는 "폐기", EIA §7.3/AU-07 은 "rotation"으로 반대 서술)
  - 상세: 이번 PR 의 코드는 `InteractionRevokeTokenDto` 주석을 메커니즘(무효화+재발급) 기준으로 중립적으로 적어
    양쪽 서술 중 어느 쪽도 일방적으로 확정하지 않았고, `sessions/latest` 라우트도 스펙 표를 고치지 않고 트래커에만
    등재했다(`success-advert.md` "검토 경고 처리" 표에서 두 항목 모두 "트래커 등재(planner)"로 명시 처분). 즉 target 은
    이 두 미해결 결정을 우회하거나 선점하지 않았다
  - 제안: 없음 — 두 항목은 별도 planner 턴에서 처리될 사안으로 이미 올바르게 분리됨

## 요약

이 PR(`success-advert`)이 닫으려는 트래커 항목 "성공 응답 미광고 라우트 15곳"은 선행 plan(`post-status-openapi`)이
명시적으로 "별 결정으로 미룬" 항목이었고, 이번 PR 은 그 결정을 임의로 내린 것이 아니라 (1) 별도 planner draft
(`spec-draft-swagger-success-advert.md`) → `--spec` 검토 통과 → spec 반영 → (2) `--impl-prep` 검토 통과 → 구현이라는
정규 절차를 그대로 밟았다. 코드 diff 는 응답 DTO·swagger 데코레이터·정적 가드 강화에 국한되어 트리거 동시쓰기
직렬화(§3 advisory lock)·chat-channel·EIA 등 다른 진행 중 plan 이 다루는 영역의 동작을 건드리지 않는다. `--impl-prep`
단계에서 이미 식별된 두 개의 진짜 미해결 결정(`sessions/latest` 표 누락, `revoke-token` 명명 불일치)은 이번 PR 이
선점적으로 확정하지 않고 트래커에 정확히 등재해 두었다. Critical 급 충돌은 없으며, 발견된 사항은 모두 정상적인
plan lifecycle 마무리 절차(트래커 체크, draft plan 정리)에 관한 INFO 수준이다.

## 위험도
LOW
