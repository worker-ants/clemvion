### 발견사항

- **[WARNING]** `spec/5-system/2-api-convention.md §7` Rate Limiting 표를 probe 3종 SoT 로 선언하면서 KB re-embed 3/min 은 포함되지 않는 부분적 커버리지 문제
  - target 위치: plan 변경 #3 ("Provider probe API 3종 10 req/min 행 추가") 및 Rationale "Rate Limiting 정책 SoT 는 `2-api-convention.md §7` 단일 표로 유지"
  - 충돌 대상: `spec/5-system/8-embedding-pipeline.md §368` — `KnowledgeBaseController: POST /:id/re-embed (HTTP 202, editor, @Throttle 3/min)` 가 이미 해당 섹션 본문에 직접 기술되어 있고 `2-api-convention.md §7` 표에는 없다.
  - 상세: target 이 `§7` 을 "Rate Limiting 정책 SoT 단일 표"로 선언하면 KB re-embed `@Throttle 3/min` 은 §7 에 없는 누락 항목이 된다. §7 표가 "endpoint-specific 오버라이드 완전 목록"처럼 읽히면 KB re-embed 가 글로벌 100/min 을 상속한다는 오해가 생긴다. 반면 §7 에 추가 안 하면 probe 3종만 §7 에 등재되는 비일관적 분류 기준이 생긴다.
  - 제안: 두 가지 중 하나를 선택한다. (a) `2-api-convention.md §7` 에 KB re-embed 3/min 행도 함께 추가해 endpoint-specific 오버라이드 목록을 일관되게 유지한다. (b) target Rationale 에 "§7 표는 전체 열거가 아닌 대표 정책 예시이며, endpoint-specific @Throttle 오버라이드는 각 영역 spec 에 위임된다"고 명시해 표의 범위를 제한한다. (a) 가 일관성 면에서 우위.

- **[INFO]** `spec/5-system/7-llm-client.md §5.5` 에 throttle 값(10/60s)이 inline 으로 남으면서 동시에 SoT 가 §7 임을 cross-ref 하는 이중 출처 상황
  - target 위치: 변경 #4 ("preview-models `@Throttle(10/60s)` 언급에 … 정책 SoT 는 §7 한 줄 추가")
  - 충돌 대상: `spec/5-system/7-llm-client.md §5.5` 기존 문장 `30초 timeout 및 @Throttle(10/60s) Rate limit 적용.`
  - 상세: 변경 #4 는 기존 inline `@Throttle(10/60s)` 표현을 제거하지 않고 cross-ref 를 한 줄 추가한다. 결과적으로 §5.5 는 "10/60s"라는 값 자체도 갖고, §7 을 SoT 로도 참조하는 이중 출처가 된다. 향후 throttle 값이 변경될 때 §7 만 수정하고 §5.5 의 "10/60s" 는 남으면 drift 가 발생한다.
  - 제안: 변경 #4 적용 시 §5.5 의 `@Throttle(10/60s)` 구체 값을 "정책 SoT §7" 참조 표현으로 대체(값 제거 + 링크)하거나, 또는 값을 남기되 "(`2-api-convention.md §7` 의 `PROVIDER_PROBE_THROTTLE` 상수 기준)" 로 출처를 inline 명시한다. 어느 쪽이든 단일 진실을 명확히 한다.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §371` 의 stale 컨트롤러명 `LlmConfigController` 는 target 이 수정하려는 내용과 일치하며 충돌이 없음
  - target 위치: 변경 #1 ("stale 한 `LlmConfigController` 참조를 `LlmModelConfigController`로 정정")
  - 충돌 대상: `spec/5-system/7-llm-client.md §5.5·Rationale` (line 478) 에서 이미 `LlmModelConfigController`(llm 모듈, 라우트 무변)가 정식 명칭으로 기술됨. `spec/data-flow/7-llm-usage.md §1.1` (line 50) 에서도 `llm-model-config.controller.ts — llm 모듈 소유`로 기술됨.
  - 상세: target 의 수정 방향이 두 spec 의 현재 기술과 완전히 일치한다. 수정 후 모든 영역이 정합된다.
  - 제안: 수정 진행.

- **[INFO]** `spec/2-navigation/6-config.md §3` 이미 `ParseEnumPipe` 400 동작을 명시 — target 이 `8-embedding-pipeline.md` 와 `data-flow/7-llm-usage.md` 에 추가하는 것은 parity 보완이며 충돌 없음
  - target 위치: 변경 #1(I-1) 및 변경 #2(I-1 parity)
  - 충돌 대상: `spec/2-navigation/6-config.md §3` line 283 — `허용값 외 type 은 400 Bad Request(컨트롤러 ParseEnumPipe 강제)` 가 이미 기술됨.
  - 상세: 동일 동작이 이미 한 곳(`6-config.md §3`)에 문서화되어 있으며 target 이 두 추가 spec 에 같은 내용을 반영한다. 모순 없음. 단, 향후 동작 변경 시 세 곳 모두 갱신 필요.
  - 제안: target 의 두 spec 수정 시 `6-config.md §3` 을 추가 갱신 없이 그대로 두어도 된다(이미 최신). 단 세 문서가 같은 사실을 기술하므로 drift 위험을 인지하고 향후 수정 체크리스트에 포함한다.

---

### 요약

target 은 이미 머지 완료된 동작(PR #716·#718)을 spec 에 doc-sync 하는 작업으로 신규 요구사항·데이터 모델·API 계약 변경이 없다. 검토한 4개 spec 파일(`8-embedding-pipeline.md`, `data-flow/7-llm-usage.md`, `2-api-convention.md §7`, `7-llm-client.md §5.5`)과 연관 파일(`6-config.md §3`, `1-data-model.md §2.16`) 사이에 직접 모순은 발견되지 않는다. WARNING 1건은 `§7` Rate Limiting 표를 "SoT"로 선언하면서 기존 KB re-embed `@Throttle 3/min`(이미 `spec/5-system/8-embedding-pipeline.md §368` 에 존재)가 §7 에 누락되어 표의 완전성 보증이 불명확해지는 문제다. INFO 2건은 throttle 값 이중 출처와 세 위치에 분산되는 `ParseEnumPipe` 400 기술에 관한 동기화 주의사항이다.

### 위험도

LOW
