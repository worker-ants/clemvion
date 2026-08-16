# RESOLUTION — `23_08_19` ai-review 후속 조치

**CRITICAL 0 · WARNING 8** — 8건 **전부 이 PR 안에서 조치**했다(이연 0건).
forced 화이트리스트 7명 전원 결과 확보(`forced_missing` 공집합), `unfinished` 공집합,
디스크 파일 7 + SUMMARY = 8 로 반환값과 일치(디스크-쓰기 갭 없음).

| # | 카테고리 | 조치 | 위치 |
|---|---|---|---|
| 1 | SPEC-DRIFT | **반영** — §R17 잔여 ①·② flip(③ 유지) + emit 마스킹 카탈로그 불릿 신설 + 표면 열거를 "여섯 표면·세 컬럼" 으로 갱신. WS §4.1 마스킹 캐비엇 신설, `:184` 자기모순 각주 정정. `12-webhook §5.3` 스코프 캐비엇. plan frontmatter `spec_impact` 추가 | `14-external-interaction-api.md` · `6-websocket-protocol.md` · `12-webhook.md` |
| 2 | Documentation | **반영** — `inputData`/`outputData` Swagger 설명에 마스킹 사실 + `[REDACTED]` 마커 보존 + SoT 링크 추가(자매 `error` 와 대칭) | `execution-response.dto.ts`(2곳) · `background-run-response.dto.ts` |
| 3 | Requirement | **반영** — plan 최상단 택일 표 A·B 행을 취소선+정정으로 갱신, §A 소제목을 "재택일" 로 교체하고 반증된 초판 주장을 인용으로 보존 | `eia-fanout-and-internal-data-masking.md` |
| 4 | Testing | **반영** — `redactStoredDataForResponse` 전용 describe 8건 추가(자매 스위트와 같은 항목 각각: 값 마스킹·중첩 키·null 정규화·비변이·copy-on-change·마커 보존 캐너리·잔여 갭 캐너리·무손상 캐너리) | `redact-stored-error.spec.ts` |
| 5 | Testing | **반영** — `⑥-b` 신설. 필드 하나만 leaky 한 행을 섞어 **참조 동일성**으로 세 항 AND 비교를 가른다. **뮤테이션 검증**: `inputData === ne.inputData` 항 제거 → 이 테스트만 RED(그 전엔 전부 GREEN 이었다) | `executions.service.spec.ts` |
| 6 | Maintainability | **반영** — `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 를 export 상수로 승격하고 `MASKED_MARKERS` 와 `websocket.service` 가 **같은 상수를 공유**. 한쪽만 바뀌어 재마스킹 방지가 조용히 깨지는 경로를 없앴다 | `sanitize-error-message.ts` · `websocket.service.ts` |
| 7 | Maintainability | **반영** — `maskIfPresent` 헬퍼로 3회 반복 축약 | `executions.service.ts` |
| 8 | Documentation | **반영** — CHANGELOG `## Unreleased` 항목 추가(⚠️ wire 변화·성능 실측 포함) | `CHANGELOG.md` |

## INFO 처리

- **Security INFO 1·2·3 / Side-effect INFO 6·7·8**: 조치 없음 — 전부 설계 의도이거나 범위 밖임을
  리뷰어 스스로 명시했다. INFO 8(타입 확장이 diff 밖 소비자에 영향)은 **실측으로 확인** —
  `ResponseExecution`/`ResponseNodeExecution` 를 import 하는 소스 모듈은 **0건**(`dist/` 만
  참조, 재생성됨). `nest build` PASS 로도 교차 확인.
- **Scope INFO 4**(plan-lifecycle 정리가 같은 diff 에 포함): PR 설명에 별개 사유임을 명시한다.
- **Maintainability INFO 9·10·11**(3줄 블록 반복 · 두 `redactStored*` 본문 동일 · 동사 혼용):
  **의도적 미조치**. 9·10 은 리뷰어도 *"호출 여부의 개별성은 유지(강제 통합 지양)"* 라 적었고,
  두 함수를 한쪽이 다른 쪽을 부르게 묶으면 §R17 이 열거로 못박은 "컬럼별 관문" 이 흐려진다.
  11 은 `maskWireEnvelope` 가 조립 함수라 `to*`/`mask*` 계열을 의도적으로 갈라 쓴 것이다.
- **Testing INFO 13**(`stop()` 에서 `inputData` 비대칭): 공통 관문 재사용이라 간접 커버되고,
  리뷰어도 "필수 아님" 으로 적었다. 미조치.
- **Testing INFO 14**(`emitKbEvent`/`emitBackgroundRunEvent` 가 마스킹 밖): **실측 후 의도적
  범위 밖**. 두 채널(`kb:<id>` · `background:run:<id>`)은 `executionEventSubject` 로 fanout 되지
  않아 외부 수신자가 없다 — 이 작업이 닫으려는 표면이 아니다. 트래커에 등재하지 않는 이유도
  같다(누출 경로 부재).

## 이 라운드에서 **새로 발견**해 트래커에 등재한 것

- **`SECRET_LEAK_PATTERNS` 가 bare `token=` 을 안 잡는다** — 테스트 fixture 를
  `token=sk-live-abc123` 으로 썼다가 **통과하는 것을 보고** 알았다(fixture 를 `Bearer …` 로
  교체). `access_token`/`api_key` 는 있는데 `token` 단독이 없는 비대칭이다. 이 PR 이 만든
  결함이 아니고 패턴 확장은 캐너리가 막는 별건이라
  `spec-sync-external-interaction-api-gaps.md` 에 자매 항목으로 등재했다.

## 검증

- TEST WORKFLOW 4단계 PASS — lint / unit(백엔드 **427 suites · 8,809 tests**) / build / e2e **276**
- **build 가 두 번 결함을 잡았다**(유닛은 통과):
  ① 응답 타입이 `| null` 을 거부 → `error` 와 같은 방식으로 확장
  ② `maskIfPresent<T>` 의 `T` 가 값이 아니라 `mask` 파라미터에서 추론돼 `undefined` 흡수 →
  제네릭 제거하고 구체 타입 고정
- **plan 링크 가드가 draft 를 잡았다** — 인용 블록 속 `./` 링크가 `spec/5-system/` 기준이라
  `plan/in-progress/` 에서는 실재하지 않는다. 코드 스팬으로 바꾸고 그 이유를 draft 서두에 기록
- `/consistency-check --spec`(`23_10_41`) **BLOCK: NO** — 그 WARNING 3건도 이 라운드에 함께
  반영했다(WS `:184` 자기모순 · plan 표 stale · draft `## Rationale` 부재)
