# Code Review 통합 보고서

## 전체 위험도
**NONE** — `team_invite` 알림 `channel` 값을 `'both'` → `'in_app'` 로 낮추는 단일 리터럴 수정 + 동반 문서/테스트 갱신. 확인 가능한 3개 reviewer(scope, maintainability, testing) 모두 CRITICAL/WARNING 없이 NONE 판정. 단, security/requirement/side_effect/documentation 4개 reviewer 는 결과 파일이 유실되어 내용 확인 불가 — 재시도 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | 코드 2줄 diff 대비 부속 산출물 11개 동반(plan 완료 이동, consistency-check 6개 파일, spec 문서 2곳)이나 모두 CLAUDE.md 규약(spec read-only developer → planner 위임 → consistency-check 의무 → plan 완료 이동)이 요구하는 필수 산출물 | `plan/complete/spec-update-notifications-firing.md`, `review/consistency/2026/07/06/20_57_56/*`, `spec/2-navigation/9-user-profile.md`, `spec/data-flow/8-notifications.md` | 조치 불요 |
| 2 | scope | spec 산문 변경이 "channel in_app 하향" 결정의 근거·기각 대안 서술에만 한정, 무관 섹션(`execution_failed`, `schedule_failed` 등) 미변경 | `spec/data-flow/8-notifications.md` §1.1, `spec/2-navigation/9-user-profile.md` §5.1 | 조치 불요 |
| 3 | scope | consistency-check SUMMARY 가 지적한 인접 spec drift(§11.2 dedup, data-model §2.19, §12.1 dismiss endpoint)는 이번 커밋과 무관하다고 명시적으로 이월 처분, 실제로 손대지 않음 | `review/consistency/2026/07/06/20_57_56/SUMMARY.md` | 조치 불요 (별도 grooming 대상으로 이월 확인됨) |
| 4 | scope | 테스트 파일 변경이 실질 변경에 정확히 대응하는 최소 diff(2줄) | `workspace-invitations.service.spec.ts` | 조치 불요 |
| 5 | maintainability | `channel` 값(`'in_app'`, `'both'`)이 문자열 리터럴로 하드코딩 — 기존 관례를 따른 것으로 신규 도입 문제 아님 | `workspace-invitations.service.ts`, `.spec.ts` | `NotificationsService.notify()` 의 `channel` 파라미터가 이미 리터럴 유니온 타입이면 조치 불요 |
| 6 | maintainability | docstring 이 3→7줄로 확장되며 spec Rationale 과 유사 설명이 코드 주석에도 재서술되어 경미한 중복. spec 참조 링크 포함되어 SoT 원칙은 유지 | `workspace-invitations.service.ts` | 현행 유지 |
| 7 | maintainability | 테스트 케이스명이 실제 검증 내용(`channel: 'in_app'`)과 정확히 일치 | `.service.spec.ts` | 조치 불요 |
| 8 | testing | 변경 범위가 단일 리터럴 갱신에 한정, 대응 스펙 30개 테스트 전부 통과 | `.service.spec.ts` | 조치 불요 |
| 9 | testing | `in_app` 채널의 다운스트림(이메일 미발송)은 `NotificationsService` 기존 테스트로 커버 — 새 갭 없음. "이메일 중복 회피" 의도를 e2e/integration 으로 고정하는 테스트는 없음 | `notifications.service.spec.ts` | (선택) 초대 API → 이메일 발송 mock 호출 횟수 1회 확인 통합 테스트 고려. Critical 아님 |
| 10 | testing | 테스트명이 한글로 의도(channel=in_app)를 명확히 표현 | `.service.spec.ts` | 조치 불요 |
| 11 | testing | Mock 이 `mockResolvedValueOnce` 순차 체이닝으로 호출 순서 결합(기존 관례, 신규 아님) | `.service.spec.ts` | 이번 범위와 무관, 우선순위 낮음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| scope | NONE | 부속 산출물 전부 규약상 필수, 스코프 이탈 없음 |
| maintainability | NONE | 단일 리터럴 변경, 복잡도/네이밍/중복 영향 없음 |
| testing | NONE | 30개 테스트 통과, 커버리지 갭 없음(강화 제안만) |
| security | 재실행 완료 (하단 참조) | — |
| requirement | 재실행 완료 (하단 참조) | — |
| side_effect | 재실행 완료 (하단 참조) | — |
| documentation | 재실행 완료 (하단 참조) | — |

## 라우터 결정

- `routing=done`: **실행** security/requirement/scope/side_effect/maintainability/testing/documentation (7); **제외** performance/architecture/dependency/database/concurrency/api_contract/user_guide_sync (7, 단일 리터럴 값 변경이라 해당 관점 무영향).

---

## 후속 (4개 유실 reviewer 재실행 결과) — 최종 판정

1차 workflow 에서 security/requirement/side_effect/documentation 4개 reviewer 가 status=success 로
보고됐으나 output 파일이 디스크에 없어 재실행했다. 결과: **7개 reviewer 전부 완료, Critical 0 / Warning 0.**

| Reviewer | 재실행 STATUS | Critical | 핵심 |
|----------|--------------|----------|------|
| security | highest=NONE | 0 | 인증/인가/시크릿/인젝션 표면 무영향 (채널 리터럴 값 변경) |
| requirement | highest=NONE | 0 | spec §1.1/§5.1 결정과 코드 정합 |
| side_effect | highest=NONE | 0 | 부작용·시그니처 변경 없음 (best-effort try/catch 유지) |
| documentation | highest=LOW | 0 | CHANGELOG PR3 Unreleased 항목이 team_invite=`both` 로 남아 있어 실제(`in_app`)와 불일치 → **본 마무리에서 수정** |

**최종: 전체 위험도 NONE — Critical/Warning 0건.** 후속 fix 1건(documentation LOW) 조치 완료, 나머지는
전부 INFO 수준 무조치. 상세 처분은 `RESOLUTION.md`.
