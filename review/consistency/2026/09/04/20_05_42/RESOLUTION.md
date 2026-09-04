# RESOLUTION — `--impl-done` `20_05_42`

**BLOCK: NO** (Critical 0). WARNING 2 · INFO 4 — 아래대로 처리했다.

## 조치 항목

| # | 발견 | 조치 |
|---|---|---|
| W1 | DTO JSDoc 의 **내부 개발 서사가 공개 OpenAPI `description` 으로 노출**된다 | **검증 후 수정.** `nest-cli.json` 에 `@nestjs/swagger` 플러그인이 실제로 켜져 있어 JSDoc 이 그대로 나간다. 소비자용 2문장으로 축약하고 경위는 비-JSDoc 주석 + CHANGELOG 로 옮겼다 |
| INFO#2 | CHANGELOG 의 라우트 표기가 틀렸다 — `/api/alerts/rules` (실제 `/api/alerts`) | **내 오기다.** `@Controller('alerts')` 확인 후 CHANGELOG·plan 각 1곳 정정 |
| W2 | numeric 불변식이 가드로만 강제되고 `swagger.md` 에 규약화되지 않음 | **planner 트랙** — `spec/` 쓰기라 developer 권한 밖. plan 에 등재 |
| INFO#1·#3 | `threshold` 읽기/쓰기 비대칭이 spec 에 미문서화 (`9-user-profile.md` §6.3 / `1-data-model.md` §2.25 `Float` 라벨) | planner 트랙. `Float` 라벨 항목은 직전 라운드에 이미 등재했고 같은 축이다 |
| INFO#4 | `3-schedule.md` Rationale 이 stale plan 경로 인용 | **이 diff 와 무관한 선재 상태**. planner 트랙이라 여기서 안 고친다 |

## W1 — 확인하고 고쳤다

리뷰어의 주장("JSDoc 이 공개 description 으로 나간다")을 그대로 받지 않고 확인했다 —
`codebase/backend/nest-cli.json` 의 `plugins` 에 `@nestjs/swagger` 가 있다. **사실이다.**

그래서 *"종전 `number` 라고 적었다 — 거짓이었다"* 같은 내부 서사가 API 문서에 실릴
상태였다. JSDoc 은 **소비자에게 필요한 것**(문자열로 내려간다 · 이유 · 쓰기는 number)만
남기고, 그 위에 **비-JSDoc 주석**으로 "여기 서사를 넣으면 API 문서에 실린다" 는 경고를
달았다 — 다음 사람이 같은 실수를 하지 않도록.

## TEST 결과

- lint: **PASS**
- unit: **PASS** — backend jest 445스위트 **9,328건**
- build: **PASS**
- e2e: **PASS** — 292건
