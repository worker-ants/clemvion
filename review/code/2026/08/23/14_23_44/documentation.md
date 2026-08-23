# 문서화(Documentation) Review — masking-gate-consolidation

## 검토 범위 메모

리뷰 대상 14개 파일 중 실제 코드/스펙 산문 변경은 3개(`background-runs.service.ts`·
`executions.service.ts`·`spec/conventions/egress-masking.md`) + 신규 유틸 파일 1개
(`redact-stored-error.ts`) + 신규 plan 파일 1개(`masking-gate-consolidation.md`) +
기존 tracker 갱신 1개(`spec-sync-external-interaction-api-gaps.md`)다. 나머지
7개는 이전 `/consistency-check --impl-prep` (13:55:36) 세션이 산출한 리뷰 아티팩트
(`review/consistency/2026/08/23/13_55_36/**`)로, 그 자체가 코드/문서 변경이 아니라
검토 산출물이므로 문서화 관점 점검 대상에서 제외했다(대신 그 안의 지적사항이 이번 커밋
diff 에서 실제로 반영됐는지는 교차 확인했다).

`executions.service.ts` 전체 파일 컨텍스트가 프롬프트 예산으로 465/1098 줄만 실려
있어, `toResponseExecution`/`stop`/`redact-stored-error.ts` 관련 JSDoc 전문은 저장소
파일을 직접 `Read` 해 대조했다.

## 교차 확인 — 이전 consistency-check 지적사항의 실제 반영 여부

`13_55_36` 세션의 `plan_coherence.md` WARNING(트래커 §1 표 "동반 갱신" 반증 근거가
tracker 자체에 기록 안 됨)과 INFO(`toResponseExecution` JSDoc 이 옛 개별 함수 심볼만
인용) 두 건 모두, 지금 diff 에서 실제로 해소되어 있음을 확인했다:

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 항목이
  `[x]` 로 체크되고 "집행 결과"·"뮤테이션 검증" 블록쿼트가 추가돼 반증 근거가 트래커에
  직접 남았다.
- `executions.service.ts` 에서 `redactStoredErrorForResponse`/`redactStoredDataForResponse`
  직접 참조를 grep 했으나 0건 — `toResponseExecution` JSDoc 의 세 곳(§2 설명·읽기
  표면 표 5행·반환 타입 설명)이 모두 `redactStoredFieldsForResponse`/
  `redactNodeExecutionRow` 로 갱신돼 있다.
- `plan/in-progress/masking-gate-consolidation.md` 체크리스트도 `rationale_continuity`
  가 지적한 대로 실제 작업 완료 상태와 동기화돼 `- [ ] /ai-review` 한 항목만 남았다.

즉 이전 라운드가 남긴 문서화 관련 발견은 이번 커밋에서 이미 자체 해소됐다 — 재차
발견사항으로 올리지 않는다.

## 발견사항

- **[INFO]** `redact-stored-error.ts` 신설 함수 2개가 파일 내 기존 자매 함수와 JSDoc
  태그 스타일이 다르다 (`@param`/`@returns` 누락)
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`
    `redactStoredFieldsForResponse` (게이트 73~111) · `redactNodeExecutionRow`
    (게이트 134~159)
  - 상세: 같은 파일의 기존 두 함수 `redactStoredErrorForResponse`(게이트 6~35)·
    `redactStoredDataForResponse`(게이트 37~71)는 `@param`/`@returns` 태그로 입력·
    반환값을 명시한다. 이번에 신설된 `redactStoredFieldsForResponse`·
    `redactNodeExecutionRow` 는 "왜 존재하나"·"왜 둘인가" 를 설명하는 산문 docstring은
    매우 충실하지만(비교 표까지 포함) `@param row`/`@returns` 형식 태그가 없다. IDE
    hover 요약이나 TSDoc 파서 기준으로 보면 같은 파일 안에서 함수별 문서 형식이
    갈린다. 기능적 이해에는 지장이 없으나(산문이 파라미터·반환 의미를 이미 충분히
    설명), 스타일 일관성 관점에서 사소한 간극이다.
  - 제안: 급하지 않음 — 이 파일을 다음에 손댈 때 `@param row`/`@returns` 태그를
    보완해 4개 export 함수의 JSDoc 형식을 통일하는 것을 고려. 이번 PR 을 막을 사안은
    아니다.

## 정합성 확인 (문제 없음 — 참고로 기록)

- **주석 정확성**: `background-runs.service.ts` 게이트 299~301 의 "읽기 표면 전체
  목록은 `ExecutionsService.toResponseExecution` 의 표가 정본" 주석은 변경 전후로
  그대로 유지되며, 실제로 그 표(게이트 1038~1045)가 최신 헬퍼 이름을 반영하고 있어
  여전히 정확하다.
- **주석 정확성**: `executions.service.ts` 게이트 700~704 의 "세 컬럼 마스킹 +
  copy-on-change 는 헬퍼가 소유한다 — 위 주석의 이유가 그 docstring 에 있다" 는
  실제로 `redact-stored-error.ts` 의 `redactNodeExecutionRow` docstring(게이트
  134~142)이 그 이유(불필요한 shallow-copy 회피, `17_12_34` performance W1)를
  그대로 담고 있어 참조가 유효하다.
- **spec 문서 정정 방식**: `spec/conventions/egress-masking.md` §3 의 정정은 취소선
  + 날짜 있는 반증 문단 + "교훈" 요약으로 마무리돼, 해당 문서 §Overview 가 스스로
  규정한 "인용은 심볼 기준, 라인 번호 금지" 규약도 그대로 지킨다(신규 문단이 심볼명만
  인용, 라인 번호 없음).
- **링크 유효성**: `redact-stored-error.ts` 새 JSDoc 의 상대경로 링크
  (`../../../../../spec/5-system/14-external-interaction-api.md`,
  `../../../../../spec/5-system/12-webhook.md`, 기존 함수 것도 포함)를 실제로
  `os.path` 정규화해 확인한 결과 둘 다 저장소 내 존재 파일로 정확히 해석된다.
- **spec SoT 와 코드 심볼의 층위 분리**: `spec/5-system/14-external-interaction-api.md`
  §R17(게이트 1505~1538)은 여전히 `redactStoredErrorForResponse`/
  `redactStoredDataForResponse` 를 "담당" 함수로 명시하는데, 이는 stale 이 아니라
  이번 PR 이 §3 정정에서 확립한 것과 같은 "마스커(함수) 좌표계 vs 호출부(래퍼) 좌표계"
  분리를 그대로 따른 것이다 — 실제 마스킹 로직은 여전히 그 두 함수가 수행하고,
  `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 는 그 위에 얹힌 호출부
  통합 계층이다. §R17 은 "소스 정본은 `ExecutionsService.toResponseExecution` 의
  표" 라고 명시해 표면 열거의 최신성 책임을 코드 쪽에 위임해 뒀고, 그 표는 이미
  최신 헬퍼 이름을 반영한다.
- **CHANGELOG**: 루트 `CHANGELOG.md` 는 사용자 관측 가능한 behavior change(특히
  breaking change)만 기록하는 컨벤션이 실제 항목들(모두 API 응답/에러코드 변경 등)로
  확인된다. 이번 작업은 plan 문서·mutation 테스트로 "동작 무변경" 이 명시적으로
  검증돼 있어 CHANGELOG 항목이 불필요하다는 판단이 맞다.
- **README**: 신규 환경변수·설정 옵션·공개 API 변경이 없어(내부 서비스 계층 리팩터,
  같은 응답 shape) `codebase/backend/README.md` 등 README 갱신 불요.
- **plan 체크리스트/lifecycle**: `masking-gate-consolidation.md` 는 `/ai-review`
  항목만 미체크로 남아 있고, 이는 이 리뷰가 실행 중인 현재 시점과 정합적이다
  (lifecycle 상 `plan/complete/` 이동은 리뷰 종료 후).

## 요약

이번 diff 는 마스킹 게이트 4곳을 헬퍼 2개로 통합하는 순수 리팩터이며, 문서화 품질이
전반적으로 높다 — 신설 함수 각각에 "왜 존재하나"·"왜 둘로 나눴나"를 설명하는
비교표까지 포함한 JSDoc, 틀린 예고를 취소선+정정 문단으로 남긴 spec 정정, tracker
문서에 반증 근거를 직접 기록한 plan 갱신, 그리고 `toResponseExecution` JSDoc 의
심볼 참조 3곳 갱신까지 이전 consistency-check 라운드가 지적한 항목들이 이미 이번
커밋 안에서 스스로 해소돼 있다. CRITICAL/WARNING 급 문서화 결함은 발견하지 못했다.
유일한 발견은 신설 함수 2개가 같은 파일의 기존 함수와 달리 `@param`/`@returns`
형식 태그를 쓰지 않는다는 사소한 스타일 불일치(INFO)뿐이다.

## 위험도

LOW
