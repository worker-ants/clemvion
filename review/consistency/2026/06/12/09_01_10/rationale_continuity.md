### 발견사항

- **[CRITICAL]** `LLM_CONFIG_INVALID` 를 "retired" 로 등재하면서 해당 코드가 아직 live 상태
  - target 위치: `§3 historical-artifact` 제안 — `LLM_CONFIG_INVALID → MODEL_CONFIG_INVALID` 행
  - 과거 결정 출처: `spec/conventions/error-codes.md §2 안정성/rename 정책`
  - 상세: `error-codes.md §2` 는 "에러 코드 rename 은 breaking change 다 — deprecated alias·이중 발행·마이그레이션 부담이 발생한다"고 명시하며, 기존 코드 안정성이 핵심 원칙이다. 그런데 target draft 는 `LLM_CONFIG_INVALID` 를 historical-artifact(retired) 로 등재하면서, 이 코드가 `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm-preview.service.ts` 에서 여전히 400 응답으로 발행되고 있고(`llm-preview.service.ts` line 39, 48, 69), `spec/5-system/7-llm-client.md §5.5·§6` 표에도 활성 코드로 등재되어 있다는 점을 무시한다. "retired" 등재는 클라이언트에게 이 코드가 더 이상 오지 않는다고 암시하지만, 실제로는 계속 발행된다. historical-artifact §3 의 기존 선례(invite flow lowercase 코드, OAuth callback redirect param)는 모두 "원칙 위반이나 안정성 때문에 바꿀 수 없는 기존 코드 등재" 목적이지 "rename 한 코드의 구버전 기록" 목적이 아니다. 이 draft 가 그 레지스트리를 다른 목적으로 전용하려 한다.
  - 제안: `LLM_CONFIG_INVALID` 를 완전히 `MODEL_CONFIG_INVALID` 로 교체하는 코드 변경이 선행되어야 spec historical-artifact 등재가 의미를 가진다. 또는, 아직 코드 제거가 완료되지 않았다면 target draft 의 §3 등재를 "코드 제거 완료 후 별도 spec 갱신"으로 분리하고 본 draft 에서는 제외해야 한다. 만약 `LLM_CONFIG_INVALID`(`llm-preview.service.ts` 경로 한정)가 이번 PR4b 범위에서 제거됐다면 그 사실을 target 에 명시해야 한다.

- **[CRITICAL]** `MODEL_CONFIG_DEFAULT_MISSING` 코드가 spec 에도 코드베이스에도 존재하지 않는 상태에서 historical-artifact 대체 코드로 기재
  - target 위치: `§3 historical-artifact` 제안 — `LLM_CONFIG_NOT_FOUND → MODEL_CONFIG_DEFAULT_MISSING (400)` 행 및 `§2 error-handling §1.3 변경` — `MODEL_CONFIG_DEFAULT_MISSING` 신규 행 추가
  - 과거 결정 출처: `spec/conventions/error-codes.md §2 안정성/rename 정책` + `spec/5-system/3-error-handling.md §1.3` 현행 `MODEL_CONFIG_NOT_FOUND` 정의
  - 상세: `spec/5-system/3-error-handling.md §1.3` 의 `MODEL_CONFIG_NOT_FOUND` 는 현재 "지정 id 의 ModelConfig 부재 또는 cross-kind 접근 차단(존재 누설 방지), default 해석 실패"를 하나의 코드로 포괄한다. 코드베이스의 `model-config.service.ts` line 121 에서 `resolveConfig` 의 default 미설정 경로도 `MODEL_CONFIG_NOT_FOUND(400 BadRequest)` 로 throw 한다. target draft 는 이 default 경로를 새 코드 `MODEL_CONFIG_DEFAULT_MISSING(400)` 으로 분리하자고 제안하는데, `MODEL_CONFIG_DEFAULT_MISSING` 는 어떤 코드 파일에도(`error-codes.ts` 포함) 없고 spec 에도 없다. `error-codes.md §2` 는 "의미가 분기되거나 새 조건이 생기면 신규 코드를 신설" 이라고 명시하므로 의미 분리 자체는 원칙과 합치하지만, draft 가 "이미 코드베이스에 존재하는 rename 결과"처럼 역사적 사실로 기록하는 것은 사실과 다르다. 또한 `LLM_CONFIG_NOT_FOUND` 는 `llm.service.ts` line 356 에서 현재도 발행되고 있어 진짜 retired 코드가 아니다.
  - 제안: (a) `MODEL_CONFIG_DEFAULT_MISSING` 코드를 `error-codes.ts` 에 실제 추가하고, `model-config.service.ts` `resolveConfig` 및 `resolveEmbedding` 의 default-missing throw 경로를 해당 코드로 전환한 후, (b) `llm.service.ts` `resolveConfig` 의 `LLM_CONFIG_NOT_FOUND` throw 를 `MODEL_CONFIG_DEFAULT_MISSING` 으로 교체한 다음, (c) spec §1.3 변경 및 historical-artifact 등재를 수행해야 Rationale 연속성이 유지된다. 구현이 PR4b 범위가 아니라면 target draft 에서 `MODEL_CONFIG_DEFAULT_MISSING` 관련 변경을 제외하거나 "미구현(Planned)" 으로 표기해야 한다.

- **[WARNING]** `MODEL_CONFIG_NOT_FOUND` 의 설명 수정이 기존 "default 해석 실패" 포함 의미를 무근거로 축소
  - target 위치: `§2 — spec/5-system/3-error-handling.md §1.3 변경` — `MODEL_CONFIG_NOT_FOUND` 설명을 "id 미지정 시 워크스페이스 default config 없음" 을 제외한 형태로 정정
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.3` 현행 정의 및 `spec/5-system/7-llm-client.md ## Rationale "왜 testConnection·listModels 가 kind-agnostic 조회를 쓰나"` 항(embedding/rerank 설정이 `MODEL_CONFIG_NOT_FOUND` 로 거부됐다는 회귀 기록)
  - 상세: `spec/5-system/7-llm-client.md Rationale` 에는 "구 `LlmConfigService.findEntity`(chat 고정)를 경유하면 embedding/rerank 설정이 `MODEL_CONFIG_NOT_FOUND` 로 거부돼 연결 테스트·모델 로드가 깨졌다(회귀)"는 결정 근거가 기록되어 있다. 이 Rationale 은 `MODEL_CONFIG_NOT_FOUND` 가 "id 지정 경로의 부재 + cross-kind 차단 + default 해석 실패"를 통합하는 설계 의도를 내포한다. target 이 `MODEL_CONFIG_NOT_FOUND` 설명을 "id 지정 경로 전용"으로 축소하려면, 위 Rationale 에서 합의된 코드 범위를 번복하는 것이므로 새 Rationale("왜 이제 id 지정 전용으로 분리하는가")이 함께 기재돼야 한다. 현재 target draft 에는 이 근거가 없다.
  - 제안: target 의 `§2` 변경에 "MODEL_CONFIG_NOT_FOUND 범위를 id 지정 경로로 한정하는 이유" Rationale 항을 추가하거나, `spec/5-system/3-error-handling.md ## Rationale` 에 동일 내용을 신설한다.

- **[WARNING]** `spec/7-llm-client.md §5.5, §6` 에서 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 치환 제안 — 아직 live 코드 참조가 남아 있어 spec 갱신이 거짓이 됨
  - target 위치: `§4 — spec/5-system/7-llm-client.md §5.5, §6` 구 코드명 교체
  - 과거 결정 출처: `spec/conventions/error-codes.md §2 안정성/rename 정책`
  - 상세: `llm-preview.service.ts` 가 `LLM_CONFIG_INVALID` 를 계속 발행하는 한, `spec/5-system/7-llm-client.md §6` 에 `MODEL_CONFIG_INVALID` 만 기술하면 spec 과 구현이 불일치한다. "spec 을 먼저 갱신하고 코드 따라오기" 패턴이라도 최소한 "구현 pending — `llm-preview.service.ts` LLM_CONFIG_INVALID 교체 예정" 주석이 spec 에 있어야 한다.
  - 제안: `spec/5-system/7-llm-client.md §6` 변경 시 `LLM_CONFIG_INVALID` 가 아직 코드베이스에 남아 있는 경로(llm-preview 서비스)를 "(구현 pending)" 주석으로 명시하거나, 코드 교체 완료 후 spec 을 갱신한다.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §5.5` 2-step 교체 — Rationale 연속성 문제 없음
  - target 위치: `§1 — §5.5 resolveEmbedding 폴백 체인 교체`
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md ## Rationale "결정: 다중 차원 임베딩 + KB 단위 모델 선택"` 항
  - 상세: 기존 Rationale 은 embedding 1급화(kind=embedding ModelConfig)를 "기존 KB 무중단 전환을 위한 점진적·하위호환 설계"로 기술하며, step-3(legacy 폴백)을 의도적으로 포함했다. PR4b 가 V093 repoint + V094 DROP 으로 legacy 컬럼을 실제 제거한 것은 그 점진 설계의 완료 단계이므로, spec 의 3-step을 2-step으로 갱신하는 것은 Rationale 과 충돌하지 않는다. Rationale 의 "하위호환 설계" 문구에 "PR4b(V093/V094) 이후 완료"라는 역사 각주를 추가하면 더 명확해진다.
  - 제안: `spec/5-system/8-embedding-pipeline.md ## Rationale "결정: 다중 차원 임베딩..."` 에 "step-3 legacy 폴백은 V093/V094(PR4b)에서 제거됨" 한 줄을 추가해 Rationale 역사 기록을 완성한다.

- **[INFO]** `spec/conventions/error-codes.md §3 historical-artifact` 의 목적 범위 — 현재 레지스트리 항목과 용도 불일치
  - target 위치: `§3 historical-artifact` 전체 제안
  - 과거 결정 출처: `spec/conventions/error-codes.md §3 및 ## Rationale "왜 예외 레지스트리인가"`
  - 상세: 현재 §3 레지스트리의 존재 이유는 "완벽한 이름을 소급 강제하면 breaking rename 이 양산된다 — 부정확하나 안정적인 기존 코드는 '예외 + 정의 명확화'로 흡수"이다. 기존 항목은 모두 아직 발행 중인 코드를 다룬다. target draft 가 제안하는 `LLM_CONFIG_NOT_FOUND` / `LLM_CONFIG_INVALID` 등재는 "실제 retired/replaced" 코드 추적 목적으로, §3 의 설계 목적과 레이어가 다르다. 추후 혼선 방지를 위해 §3 을 두 섹션("활성 예외 코드" vs "retired 코드")으로 분리하거나, retired 코드를 별도 §4 로 둘 것을 검토할 수 있다.
  - 제안: 현재 draft 를 진행하더라도, `spec/conventions/error-codes.md` 서두에 §3 과 새 retired 항목의 목적 차이를 한 줄 설명 추가를 권장한다.

---

### 요약

target draft 의 임베딩 파이프라인 §5.5 2-step 교체(§1)와 data-flow/navigation spec 갱신(§5·§6)은 기존 Rationale과 충돌하지 않으며 PR4b 구현 완료에 따른 정합한 spec 동기화다. 그러나 에러코드 관련 변경(§2·§3·§4)에서 두 가지 CRITICAL 문제가 있다. 첫째, `LLM_CONFIG_INVALID` 와 `LLM_CONFIG_NOT_FOUND` 는 코드베이스에서 여전히 발행 중인 live 코드인데 draft 가 이들을 "retired"로 historical-artifact 에 등재하려 한다 — `error-codes.md §2`의 "rename = breaking change, 안정성 유지" 원칙과 §3 레지스트리의 설계 목적("안정적이나 부정확한 코드 흡수") 모두와 충돌한다. 둘째, 대체 코드로 제시한 `MODEL_CONFIG_DEFAULT_MISSING` 가 spec 에도 코드베이스에도 존재하지 않아 draft 가 미완성 구현을 기정사실화하는 위험이 있다. 이 두 항목을 해소하지 않으면 spec 이 코드와 거짓으로 불일치하게 된다.

---

### 위험도

HIGH
