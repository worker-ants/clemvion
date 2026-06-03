# Code Review 통합 보고서

리뷰 대상: Channel Web Chat — 로컬 데모 호스트 + dev 포트 분리 (feat-web-chat-demo)
리뷰 일시: 2026-06-03 09:15:11

## 전체 위험도
**LOW** — dev-only 데모 하니스 추가 PR. 운영 코드 미접촉. Critical 0 / Warning 4.

## Critical
해당 없음.

## 경고 (WARNING)
| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|---|---|---|---|
| 1 | 테스트 | `DemoHost` postMessage 핸드셰이크·origin 검증·상태 전이 단위/통합 테스트 전무 (I6 검증 자동화 안 됨) | `src/app/demo/demo-host.tsx` | `demo-host.test.tsx` 작성 |
| 2 | 아키텍처 | `WIDGET_SRC`/targetOrigin same-origin 빌드타임 하드코딩 | `src/app/demo/demo-host.tsx` | 단기 허용; 중장기 `NEXT_PUBLIC_WIDGET_ORIGIN` env 분리 |
| 3 | 문서화 | `.env.example` `NEXT_PUBLIC_BASE_PATH` 주석 spec 참조 경로 불완전 | `.env.example` | 전체 경로 명시 |
| 4 | 문서화 | plan 체크박스 미갱신 | `plan/in-progress/channel-web-chat-demo.md` | `[x]` 갱신 |

## 참고 (INFO) — 핵심 발췌
- #5 `buildBootConfig` `.trim()` 중복, #4 매직넘버, #8~#11 테스트 케이스 보강(탭 구분자·whitespace primaryColor·`isDemoEnabled({})`·`isBootReady` whitespace apiBase), #2 `apiBase` URL 검증(운영 SDK 시), #1/#17 `source .env` 셸 eval(dev-only 허용).

## 에이전트별 위험도
| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| security | LOW | postMessage 보안 양호. source .env·apiBase 미검증 INFO |
| architecture | LOW | same-origin 하드코딩 WARNING |
| requirement | NONE | spec 2-sdk §3·§4 충족. I6·I9 반영 확인 |
| scope | NONE | 변경 파일 plan 1:1 대응 |
| side_effect | LOW | source .env 세션 환경 변경 가능성 |
| maintainability | LOW | 매직넘버·trim 중복·update 메모이제이션 |
| testing | LOW | DemoHost 테스트 전무 WARNING |
| documentation | LOW | plan 체크박스·.env spec 경로 |
| dependency/concurrency/api_contract | NONE | 이상 없음 |

## 라우터 결정
실행 11명(security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, concurrency, api_contract) / 제외 3명(performance, database, user_guide_sync).
