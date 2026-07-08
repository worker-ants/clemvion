# ai-review SUMMARY — 알림 설정 API (§6.2) + opt-out enforcement

- 대상: notifications(service/controller/dto) · user.entity · execution-engine·schedule-runner dispatch · spec(9-user-profile·8-notifications).
- 방식: 직접 Agent fan-out — requirement/api-contract + security.

## 위험도: LOW (Critical 0)

## 발견
| # | reviewer | sev | 요지 | 처리 |
|---|---|---|---|---|
| 1 | requirement | WARNING | `8-notifications.md §1.1` execution/schedule 행이 channel=both 무조건 서술 → opt-out 반영 안 됨(SPEC-DRIFT) | **FIX**: §1.1 두 행 opt-out 반영 |
| 2 | requirement | WARNING | `resolveOptOutEmailChannels` 가 NotificationsService 에 위치 — integration 노티파이어는 인라인, 두 패턴 공존(불변식은 보존) | **FIX(doc)**: 8-notifications §1 helper 명시(caller-orchestrated) |
| 3 | security | INFO | `@IsOptional`+`@IsBoolean` 이 `null` 우회 → null 저장. 다운스트림 `??`/`===false` 가 unset 취급, 무영향 | 수용(무해) |
| — | requirement | INFO | updateSettings RMW 경쟁(기존 workspace-settings 패턴 동일)·user-not-found 방어(도달불가) | 수용 |

## 정합 확인 (문제 없음)
- endpoint path §6.2·`{data}` 래핑·DTO whitelist(forbidNonWhitelisted)·기본값 의미론(integration opt-in/failures opt-out)·per-recipient·opt-out 범위 한정(integration/marketplace/team_invite 미영향)·additive(migration 불요).
- **security NONE**: IDOR 불가(user.sub)·mass-assignment 2중 방어(pipe+화이트리스트 루프)·JSONB 오염 없음·additive side-effect.

## 검증
unit(notifications+schedule+execution 426)·lint·build·e2e(243)·doc guards(253). BLOCK: NO.
