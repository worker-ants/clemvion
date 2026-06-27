# Requirement Review — ③ model-config polish (fresh review)

리뷰 대상: 14개 파일 (코드 10 + plan 1 + review 산출물 3). 1차 리뷰(17_23_53) 이후 resolution 조치 반영 후 fresh 리뷰.

---

## 발견사항

### 기능 완전성

- **[INFO]** 계획 4항목 전부 구현됨.
  - 위치: `plan/in-progress/mc-config-polish.md` 체크리스트 4개 모두 ✓
  - 상세:
    - (1) `SENSITIVE_ACTION_THROTTLE`(`common/constants/throttle.ts`) 추출 완료. `PROVIDER_PROBE_THROTTLE`·`INVITATION_THROTTLE` 는 이 값의 alias.
    - (2) `MODEL_TYPE_ENUM`/`ModelTypeFilter` → `model-config/dto/model-type.ts` 이전 완료. 컨트롤러·`LlmService.listModels opts.type` 모두 공유.
    - (3) `@ApiQuery({ enumName: 'ModelTypeFilter' })` 추가 완료.
    - (4) `list-models-cap.ts`(`MAX_MODEL_LIST_SIZE=500`, `capModelList`) 생성 후 `LlmService.listModels`·`LlmPreviewService.previewModels` 양 경로 적용 완료.

### 엣지 케이스

- **[INFO]** `capModelList` 빈 배열·cap 이하·정확히 cap·cap 초과 모두 테스트로 커버됨.
  - 위치: `list-models-cap.spec.ts`
  - 상세: 빈 배열은 `toBe`(참조 동일)로 검증, cap 이하·정확히 cap 도 원본 참조 반환, 초과 시 앞 N개 slice 반환. W-3 resolution 으로 logger spy 복원도 `try/finally` 로 보강됨.

### 비즈니스 로직 — cap 적용 순서

- **[INFO]** `LlmService.listModels` 에서 cap 은 캐시 저장 직전에 적용된다.
  - 위치: `llm.service.ts` 변경 diff (models = capModelList 후 listModelsCache.set)
  - 상세: 캐시에 이미 capped 목록이 저장되므로 캐시 hit 경로에서 중복 적용 없음. 의도와 구현이 일치한다.

### 반환값

- **[INFO]** `capModelList` 는 모든 경로에서 `ModelInfo[]` 반환. cap 이하: 원본 참조, 초과: slice 새 배열.
  - 위치: `list-models-cap.ts` L254–258

### spec fidelity 점검

**점검 대상 spec 문서:**
- `spec/5-system/2-api-convention.md §7` Rate Limiting
- `spec/2-navigation/6-config.md §3` Model Config API
- `spec/5-system/7-llm-client.md` frontmatter + §5.5
- `spec/data-flow/7-llm-usage.md`

**결과:**

- **[INFO]** `spec/5-system/2-api-convention.md §7` — Provider probe 행(line 191)과 초대 발송/재발송 행(line 193) 모두 추가됨. 수치(`10 req/min`, 사용자 기준)와 상수명(`PROVIDER_PROBE_THROTTLE`, `SENSITIVE_ACTION_THROTTLE`/`INVITATION_THROTTLE`)이 코드와 일치. SENSITIVE_ACTION_THROTTLE `ttl:60_000` + `limit:10` = 10/min 정합. spec §7의 "하위 3행" note(line 197)도 3행으로 갱신됨.
  - 제안: 없음 (일치).

- **[INFO]** `spec/2-navigation/6-config.md §3` — `preview-models` 행(line 282)에 "결과 수 방어적 상한 500" 기재됨. `:id/models` 행(line 283)도 "결과 수 방어적 상한 500(초과 시 앞 500개로 절단)" 기재. 코드의 `MAX_MODEL_LIST_SIZE=500`·`capModelList` 적용과 정합.

- **[INFO]** `spec/5-system/7-llm-client.md` frontmatter `code:` 에 `list-models-cap.ts` 등록(line 13) 확인. §5.5(line 323)에 cap 500 동작, `MAX_MODEL_LIST_SIZE`, 파일명, 응답 계약 무변경, provider 순서 보존 설명 모두 코드와 일치.

- **[INFO]** `spec/data-flow/7-llm-usage.md` — preview-models(line 51)·listModels(line 53) 양 경로에 "결과 수 상한 500" 기재됨. 코드와 정합.

- **[INFO] [SPEC-DRIFT]** `spec/5-system/2-api-convention.md §7` line 191 에서 `PROVIDER_PROBE_THROTTLE` 를 "컨트롤러 상수"로만 기술하며, `SENSITIVE_ACTION_THROTTLE` 의 alias 라는 관계가 명시되지 않음. line 193 의 `INVITATION_THROTTLE` 는 alias 관계가 명기됨. 코드는 양쪽 모두 alias 로 구현되어 있어 코드가 더 정확하다. 수치 정합에는 영향 없음.
  - 위치: `spec/5-system/2-api-convention.md` §7 line 191
  - 제안: 코드 유지 + spec line 191 에 "(공통 상수 `SENSITIVE_ACTION_THROTTLE` 의 별칭 `PROVIDER_PROBE_THROTTLE`)" 보완. 코드 버그 아님.

### 에러 시나리오

- **[INFO]** cap 초과는 silent 하드캡으로 처리됨 (사용자 결정 B). provider 측 에러(`withTimeout` throw 포함)는 기존 `BadRequestException` 경로 유지. `capModelList` 는 throw 하지 않아 에러 전파 없음.

---

## 요약

4항목 모두 요구사항을 완전히 충족한다. 1차 리뷰에서 지적된 W-1(import 순서), W-3(spy 복원), I-3(ApiTooManyRequestsResponse), I-7(as const), I-9(toBe 통일), I-13(JSDoc), I-17(frontmatter 등록) 조치가 코드에 반영됐으며, SPEC-DRIFT I-1·I-2(api-convention §7 행 추가, 6-config preview-models cap) 도 spec 업데이트로 해소됐다. 모든 spec 문서(api-convention §7, 6-config §3, 7-llm-client, data-flow)와 코드 구현이 line-level 로 정합하며, 잔여 SPEC-DRIFT 는 api-convention §7 에서 `PROVIDER_PROBE_THROTTLE` alias 관계 미기술 1건뿐(INFO, 코드 fix 불필요). 기능 정확성·에러 처리·엣지케이스에서 새로운 문제 없음.

---

## 위험도

LOW
