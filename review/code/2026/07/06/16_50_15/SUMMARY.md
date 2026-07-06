# Code Review 통합 보고서 (PR2 fresh — CTA fix 후 재검토)

## 전체 위험도
**LOW** — CRITICAL/WARNING 급 코드 결함 없음. 이메일 발송 경로가 spec §1/§2.2/§3 과 line-level 일치, 실패 격리(try/catch·allSettled) 견고. security output disk-write 갭.

## Critical
없음. (16_24_00 CTA CRITICAL 해소 확인.)

## 경고 (WARNING) — 전부 testing, 저비용
| # | 발견 | 조치 |
|---|------|------|
| 1 | notify() 단건 `channel='both'` 미검증(createMany 만 both 포함) | fix — notify both 테스트 |
| 2 | notify() default channel(생략→in_app) no-email 미검증 | fix — default 테스트 |
| 3 | sendOneEmail 발송 성공+update(email_sent_at) throw 경로 미검증 | fix — update-throw 테스트 |

## 참고 (INFO) — 비차단
- SPEC-DRIFT: spec Planned/type별 → 이미 spec-update-notifications-email.md(planner) 위임.
- entity emailSentAt `Date`(non-null) vs nullable 컬럼 = pre-existing, 범위 밖.
- await dispatchEmails 블로킹 = 16_24_00 defer 유지(PR3).
- 휴면 부작용 활성화: 배포 전 기존 notify/createMany 호출부 channel 값 grep 확인.
- CHANGELOG.md PR2 항목 = documentation 관례 → 추가 검토.
- 에러 포맷/named type/매직 문자열 중복 = 저우선 후속.

## 에이전트별
| 에이전트 | 위험도 |
|----------|--------|
| requirement/side_effect/testing/documentation | LOW |
| scope/maintainability | NONE |
| security | 재시도 필요 (disk-write 갭) |

## 판정
critical=0, warning=3(전부 testing, 저비용). fix 후 fresh review 로 수렴. SPEC-DRIFT/await-defer 는 기존 위임/결정 유지.
