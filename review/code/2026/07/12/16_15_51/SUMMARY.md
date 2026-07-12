# Code Review 통합 보고서 (복구·정정본)

**RISK: HIGH → 조치 완료. CRITICAL 1(복구) · WARNING 6 — 전부 해소.** RESOLUTION.md 참조.

> **정정 사유**: 자동 SUMMARY 는 `requirement`·`maintainability`·`user_guide_sync` 3 checker 의 **disk-write gap** 으로 이들 결과를 누락한 채 "CRITICAL 0" 을 보고했다. workflow `journal.jsonl` 에서 3 checker 전문을 복구한 결과 **requirement 가 CRITICAL 1건**(locale boot-1회 계약 위반)을 발견했다 — 자동 요약의 "CRITICAL 0" 은 거짓 음성. 5/8 확인 reviewer + 3 복구 reviewer = 전량 재집계.

## Critical (복구)
| # | Checker | 발견 | 위치 | 조치 |
|---|---|---|---|---|
| C1 | requirement | `locale` "boot 1회 고정" 계약 위반 — `useMemo(…,[config?.locale])` 로 wc:boot 재전송만으로 UI 언어 변경(spec 3곳+주석 명문화 위반, 리뷰어 repro 확인) | `widget-app.tsx:26-30` | `useRef` 1회 고정 + 회귀 테스트 (fix commit) |

## WARNING (6) — 전부 해소
| # | Checker | 발견 | 조치 |
|---|---|---|---|
| W1 | scope/documentation | doc-sync-matrix.json 재포맷 노이즈 | 원본 복원 + 1행만 삽입 |
| W2 | side_effect | panel 에러 렌더 불변식 미강제 | 주석 명시 + 검증 테스트 |
| W3 | side_effect | locale active 배포-시점 동작 변화 | CHANGELOG 명시 |
| W4 | documentation | CHANGELOG 미갱신 | Unreleased 추가 |
| W5 | documentation | README ## 상태 i18n 누락 | 항목 추가 |
| W6 | documentation | use-widget JSDoc 상충 | JSDoc 통일 |

## Checker별 위험도 (복구 후)
| Checker | 위험도 | 핵심 |
|---|---|---|
| requirement | **HIGH→해소** | C1 CRITICAL(복구). i18n 메커니즘 자체는 parity·하드코딩 잔존 0·335 tests·tsc clean 확인 |
| security | NONE | XSS/ReDoS 없음, locale 화이트리스트 검증 견고, 에러 일반화 유지 |
| side_effect | MEDIUM→해소 | W2·W3 |
| documentation | LOW→해소 | W4·W5·W6 |
| scope | MEDIUM→해소 | W1 |
| maintainability | (복구) LOW | W1 동형(포맷팅 혼입) — W1 조치로 해소 |
| user_guide_sync | (복구) | doc-sync 1:1 확인, 위젯은 유저가이드 dict 밖(스코프 정합) |
| testing | LOW | 335 tests pass. INFO 갭 일부 테스트 추가(panel 에러·freeze 회귀) |

## 재시도 필요
- 없음 — 3 disk-write-gap checker 전량 journal 복구·영속화(`requirement.md`·`maintainability.md`·`user_guide_sync.md`).

## 라우터 결정
- 실행 8: security·requirement·scope·side_effect·maintainability·testing·documentation·user_guide_sync
- 제외 6: performance·architecture·dependency·database·concurrency·api_contract (router: 순수 프레젠테이션 문자열 치환, 표준 React Context, 신규 의존성·DB·동시성·API 계약 무접촉)

BLOCK: 조치 완료 → RESOLUTION.md.
