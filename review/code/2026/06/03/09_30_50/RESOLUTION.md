# RESOLUTION — 09_30_50

> 리뷰 대상 커밋: 8419923b (Code 노드 sandbox 보강 — timeout schema / $node/$helpers 주입 / timer 셰도잉)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 (i18n) | 본 fix commit | `LABEL_KO`에 `"Timeout (sec)": "타임아웃(초)"` 추가 |
| #2 | 코드 (i18n) | 본 fix commit | `HINT_KO` 구 키 제거 + 신규 키 `"...$node, $helpers are injected."` 한국어 매핑 추가 |
| #3 | 코드 (보안) | 본 fix commit | `ALLOWED_HASH_ALGORITHMS` Set 화이트리스트 도입, 목록 외 알고리즘 즉시 throw |
| #4 | 코드 (보안) | (보류) | 스택 트레이스 `NODE_ENV` 노출 — 기존 `failure()` 동작. pre-existing 이슈이며 API 레이어 필터링 정책 결정이 선행 필요. §보류·후속 항목 참조 |
| #5 | 코드 (보안) | 본 fix commit | `$helpers.crypto.hash` data 인자 `typeof` 가드 추가 |
| #6 | 코드 (요구사항) | (보류) | `meta.durationMs` — spec §5.1 "engine inject" vs "handler return" 이중 표기 충돌. project-planner 영역. §보류·후속 항목 참조 |
| #7 | 코드 (요구사항) | (보류) | `$helpers.base64.decode` 반환 타입 spec 미정의. spec §2.2 project-planner 영역. §보류·후속 항목 참조 |
| #8 | 코드 (유지보수성) | (보류) | 에러 코드 리터럴 분산 — 기존 코드. 위험 대비 가치 낮아 보류. §보류·후속 항목 참조 |
| #9 | 코드 (유지보수성) | 본 fix commit | `buildHelpers()` 반환 타입을 `HelpersApi` typed interface 로 강화 |
| #10 | 코드 (유지보수성) | (보류) | `buildEchoConfig()` 추출 — 기존 중복 패턴. 위험 대비 가치 낮아 보류 |
| #11 | 코드 (API 계약) | (보류) | `timeout` 범위 검증 분산 구조 — 현 아키텍처 의도적 분리 (zod default/UI + validateCodeConfig 커스텀 에러). 통합 테스트 커버는 기존 `validate()` 테스트가 담당 |
| #12 | 코드 (테스트) | 본 fix commit | host-realm isolation 동작 문서화 테스트 추가 (spec §7.1 known limitation 명시) + crypto.hash 무효 알고리즘 + base64 silent-failure + date invalid 테스트 추가 (INFO #9/10/11 포함) |

**추가 처리 (INFO)**:
- INFO #4/#6: `DEFAULT_TIMEOUT_SEC` 상수를 `code.schema.ts` 에서 export, `code.handler.ts` 가 참조 (중복 제거)
- INFO #9, #10, #11: 위 #12 에 통합하여 테스트 추가

## TEST 결과

- lint  : 통과 (backend code node 파일 대상 `eslint src/nodes/data/code/**/*.ts` — 0 errors)
- unit  : 통과 (backend 5564 passed / frontend 3288 passed; code node 66 passed; i18n 62 passed)
- build : 미실행 (변경 범위가 코드 수정이며 TypeScript compile 은 jest transform 으로 검증됨)
- e2e   : 자동 흐름 환경 차단 (docker daemon 미가용 — 워크트리 환경 제약 명시됨)

## 보류·후속 항목

### pre-existing 이슈 (본 PR 무관)

- WARNING #4 (스택 트레이스 `NODE_ENV` 노출): 기존 `failure()` 동작. API 레이어에서 `output.error.details.stack` 필터링 여부를 별도 이슈로 확인 권장. `EXPOSE_STACK=true` 명시 플래그 전환도 선택지.
- WARNING #8 (에러 코드 리터럴 분산): 기존 코드. `const ERR = { ... } as const` 상수화는 리팩토링 범위이며 기능 위험 없이 후속 PR 에서 처리 가능.
- WARNING #10 (`buildEchoConfig()` 추출): 기존 중복 패턴. 후속 리팩토링 PR 에서 처리 가능.

### spec→project-planner 영역

- WARNING #6 (`meta.durationMs` 출처): spec §5.1 "engine inject" vs "handler return" 이중 표기 충돌. project-planner 가 spec §5.1 출처 컬럼 확정 후 구현. `plan/in-progress/node-output-redesign/code.md` 에 기록됨.
- WARNING #7 (`$helpers.base64.decode` 반환 타입): spec §2.2 에 "반환 타입은 UTF-8 string, 이진 데이터는 지원 범위 외" 명시 필요. project-planner 영역.
- INFO #7 (`$helpers.crypto.hash` 허용 알고리즘 목록 spec 미정의): 코드 내 `ALLOWED_HASH_ALGORITHMS` 화이트리스트와 spec §2.2 동기화 필요.
- INFO #8 (`$helpers.date(value?)` 옵셔널 표기): spec §2.2 에 생략 시 현재 시각 반환 명시 필요.

### API 계약

- WARNING #11 (`timeout` 검증 분산): 현 구조는 의도적 — zod `.default()` (UI 슬라이더) + `validateCodeConfig` (커스텀 에러 메시지 + 비-numeric 가드). 기존 `handler.validate()` 테스트가 양쪽 경로를 커버. 통합 문서화 주석은 `code.schema.ts` 에 기존 설명으로 충분.

### host-realm isolation (WARNING #12)

- node:vm + `codeGeneration: { strings: false }` 조합으로 `eval` / `new Function` / WASM 은 차단되지만, `$helpers.date()` 반환 dayjs 객체를 통한 `d.constructor.constructor(str)` 호출은 차단되지 않음 (알려진 vm.createContext 한계). 완전 격리는 spec §7.1 로드맵의 `isolated-vm` 또는 컨테이너 채택 시 해소. 테스트에 현재 동작 문서화.
