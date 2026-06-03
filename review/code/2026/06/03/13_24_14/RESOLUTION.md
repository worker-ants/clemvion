# RESOLUTION — 데모 apiBase 정규화 + 스트림 CORS 안내 + SSE onError

리뷰: `review/code/2026/06/03/13_24_14/SUMMARY.md` — RISK **LOW**, Critical **0**, Warning **2**, INFO 14.
모두 테스트 커버리지/문서 정제. 코드 결함 0. 조치: 수동(main).

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 위치 |
|---|---|---|---|
| W1·INFO11 | 테스트 | `normalizeApiBase` 경계값(`""`/`"   "`/`"/"`) + 이중 `/api`(`http://host/api/api`→`/api` 1회만) 테스트 추가 | `demo-config.test.ts` |
| W2·INFO12 | 테스트 | `openStream` 의 `error`→`onError` 전달 seam 테스트 추가(EventSource DI). use-widget 의 console.warn 은 이 seam 의 thin passthrough | `eia-client.test.ts` |
| INFO6 | 요구사항 | `buildBootConfig` omit 테스트에 `cfg.apiBase` 정규화 결과 assert 추가 | `demo-config.test.ts` |
| INFO8 | 유지보수 | CORS 힌트의 origin 하드코딩(3013) 제거 → render-computed `demoOrigin`(브라우저 실제 origin, SSR fallback). `react-hooks/set-state-in-effect` 회피 위해 effect 대신 render 계산 | `demo-host.tsx` |
| INFO13 | 문서화 | CORS 힌트 항상-노출 의도 주석 추가 | `demo-host.tsx` |

## 미조치(의도/사전존재 — 별도 scope)

- **INFO1**(SSE 토큰 `?token=` query): 기존 EIA §8.3 허용 설계, 본 변경 무관.
- **INFO2**(`configFromQuery` `apiBase` 스킴 검증): 기존 코드의 보안 하드닝 제안, 본 변경이 도입한 것 아님 — 별도 보안 increment.
- **INFO3**(`/api$/i` 대소문자): 데모 편의상 forgiving 유지(dev-only, 공격 표면 없음).
- **INFO4/5/10**(이중 `/api`·query/fragment·정규식 순서): 함수 JSDoc 이 "후행 `/api` 1개 제거"를 이미 명시. query/fragment 포함 origin 은 입력 대상 아님.
- **INFO7**(데모 하니스 spec 미기재): dev 전용 하니스 — spec 기록 여부는 project-planner 판단(현 비목표).
- **INFO9**(CORS 메시지 3곳 분산): README/데모UI/console 은 각각 다른 소비자(문서/화면/개발자콘솔)라 맥락상 중복 허용.
- **INFO14**(하드코딩 apiBase grep): 확인 — 픽스처·스니펫에 `…3011/api` 잔존 참조 없음.

## TEST 결과

- lint: **통과** (channel-web-chat eslint 0 error — `react-hooks/set-state-in-effect` 위반은 render-computed 로 해소)
- unit: **통과** (vitest 13 files / **140 tests** — 신규 normalizeApiBase 경계 2 + eia onError 1)
- build: **통과** (next build static export — `/demo` prod 제외 유지)
- e2e: **보류** — 변경 = channel-web-chat(dev 데모) + README 로 backend 무접촉, backend supertest e2e 에 신호 없음. 사용자 e2e 보류 승인(2026-06-03, 동일 PR 트랙)과 동일 구조적 사유.

## 보류·후속 항목

- INFO2(`configFromQuery` 스킴 검증)는 위젯 보안 하드닝 별도 increment 후보(본 PR 밖).
