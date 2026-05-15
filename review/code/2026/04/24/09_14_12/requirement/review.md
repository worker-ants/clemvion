4개 라운드에 걸친 리뷰 문서들을 종합하여 요구사항 충족 관점에서 분석합니다.

---

## 발견사항

### **[WARNING] `local` 프로바이더 SSRF 가드 완전 우회 — 명시적 보안 정책 결정 부재**
- **위치**: 4개 라운드 모두 반복 지적 (architecture/security/requirement 리뷰)
- **상세**: `provider !== 'local'` 조건으로 SSRF 가드를 통째로 우회하는 설계가 "의도적 결정"이라고 주석에 명시되어 있으나, 스펙 문서(`spec/5-system/7-llm-client.md §5.5`)에는 이 예외가 명시되지 않았다. editor 권한 사용자가 `local` 프로바이더로 `http://10.0.0.5:6379` 같은 내부 서비스를 탐색할 수 있는 경로가 열려 있음에도 요구사항 레벨에서 "허용"인지 "허용하되 화이트리스트 필요"인지 정의가 없다.
- **제안**: `spec/5-system/7-llm-client.md`에 local 프로바이더 허용 범위(예: "localhost/127.x.x.x만 허용" vs "내부 서비스 배포 지원") 명시. 현재 코드가 어느 요구사항을 구현한 것인지 추적 불가.

---

### **[WARNING] `isPrivateHost` IPv6 사설 대역 및 `0.0.0.0` 미차단 — 요구사항 불완전 구현**
- **위치**: security/review.md (2026-04-24_08-11-00, 08-16-06) 반복 지적
- **상세**: `::ffff:10.0.0.1`(IPv4-mapped IPv6), `fc00::/7`(ULA), `fe80::/10`(link-local), `0.0.0.0` 모두 차단되지 않는다. 요구사항이 "SSRF를 방어한다"라면 IPv4 리터럴만 검사하는 현재 구현은 요구사항을 부분 충족에 그친다. `0.0.0.0`은 많은 OS에서 loopback으로 해석되어 `a === 0` 조건 미도달로 통과된다.
- **제안**: SSRF 방어 범위를 스펙에 명시하거나, `isPrivateHost`에 `if (a === 0) return true` 및 IPv6 사설 접두사 검사 추가.

---

### **[WARNING] `provider` 변경 시 모델 목록 초기화 요구사항 미구현**
- **위치**: side_effect/review.md (2026-04-24_08-16-06), requirement/review.md (2026-04-24_08-20-33)
- **상세**: `provider`가 `openai → anthropic`으로 변경되어도 이전 openai 모델 목록이 datalist에 잔존한다. `useEffect(() => { setModels([]); }, [provider, configId])` 가 없다. 이것이 의도된 동작인지("명시적 버튼 클릭 전까지 유지") 아닌지 요구사항에 정의되어 있지 않아, 버그인지 설계인지 판별이 불가하다. 마찬가지로 `apiKey` 변경 시에도 초기화 정책이 정의되지 않았다.
- **제안**: 스펙에 "provider/apiKey 변경 시 이전 모델 목록을 초기화하는가" 명시. 현재 동작이 의도된 것이라면 주석으로 명시.

---

### **[WARNING] Google `stream()` 토큰 사용량 집계 Fallback 제거 — 과금 데이터 영향**
- **위치**: side_effect/review.md (2026-04-24_08-11-00)
- **상세**: 구 SDK의 `await result.response` fallback(스트림 청크에 `usageMetadata` 없을 때 집계값 보조 조회)이 신 SDK 마이그레이션 과정에서 삭제됐다. 일부 Gemini 모델은 청크별 usage를 스트리밍하지 않아 **토큰 사용량이 0으로 기록될 수 있다**. 이는 과금·모니터링 데이터 정확성 요구사항에 직접 영향을 준다. 신 SDK에서 이 fallback이 불필요한지 검증 없이 삭제되었다.
- **제안**: 신 SDK의 `generateContentStream` 응답에 usage가 항상 포함됨을 공식 문서 또는 통합 테스트로 검증. 검증 전까지 요구사항("토큰 사용량을 정확히 기록한다") 충족 여부 불명확.

---

### **[WARNING] Google `embed()` 배치 전환 — silent failure 가능성**
- **위치**: side_effect/review.md, requirement/review.md (2026-04-24_08-11-00)
- **상세**: N번 순차 호출 → 단일 배치 호출로 변경 시 `response.embeddings[i].values`가 없으면 `[]`(빈 벡터)를 반환하고 조용히 종료한다. 빈 벡터가 knowledge-base에 저장되면 검색 결과가 무음으로 손상된다. 배치 응답의 길이가 입력 `texts.length`와 일치하는지 검증하는 assertion이 없어 "임베딩 결과가 입력과 1:1 대응된다"는 요구사항 충족 여부 미검증.
- **제안**: `if (result.embeddings.length !== texts.length) throw new Error(...)` assertion 추가. 또는 요구사항에 "배치 실패 시 개별 폴백 허용" 명시.

---

### **[WARNING] `listModels` (저장 설정 경로) 에러 래핑 변경 — 하위 호환 검토 미완**
- **위치**: side_effect/review.md (2026-04-24_08-11-00)
- **상세**: 기존 `client.listModels()` 에러를 그대로 전파하던 것이 `BadRequestException({ code: 'LLM_MODEL_LIST_FAILED' })`로 래핑되도록 변경됐다. 기존에 이 에러 타입을 catch해 분기하던 상위 코드가 있다면 동작이 달라진다. 또한 기존에 "항상 성공"하던 `listModels`(하드코딩 반환)가 이제 네트워크 오류를 발생시킬 수 있다 — 이 변경이 기존 API 계약을 파기하는 Breaking Change인지 요구사항 레벨 검토가 없다.
- **제안**: `GET /llm-configs/:id/models` API 계약 변경(에러 시 이전: 예외 전파, 이후: `LLM_MODEL_LIST_FAILED` 400)을 API 변경 로그 또는 스펙에 명시.

---

### **[WARNING] `PreviewLlmModelsDto` 구현 파일 리뷰 미포함**
- **위치**: requirement/review.md (2026-04-24_08-11-00)
- **상세**: 컨트롤러가 `PreviewLlmModelsDto`를 import하므로 파일은 존재하지만, 리뷰 대상 diff에 포함되지 않아 `@ValidateIf`, `@IsUrl`, `@MaxLength` 등 검증 로직이 테스트 기대값과 실제로 일치하는지 독립 검증이 안 됐다. 3라운드(08-16-06)에서야 DTO 구현이 포함되어 처음 리뷰됨.
- **제안**: 스펙의 "azure/local → baseUrl 필수, file:// 차단, local → apiKey 빈 문자열 허용" 요구사항이 DTO에 정확히 구현되어 있는지 별도 확인 필요. (3라운드 requirement 리뷰 기준으로는 전체 13개 케이스 커버로 양호.)

---

### **[INFO] chat-only 모델 필터링 기준 미명시**
- **위치**: requirement/review.md (2026-04-24_08-20-33)
- **상세**: `chatModels = models.filter(m => m.type === 'chat')` 로직이 구현되어 있으나 "어떤 기준으로 모델이 chat-only인가"가 스펙에 정의되지 않았다. `type` 필드가 각 LLM 클라이언트 `listModels`에서 어떻게 설정되는지, provider마다 다른지 요구사항이 없다. 기준이 바뀌면 모든 provider에서 silent regression이 발생한다.
- **제안**: `spec/5-system/7-llm-client.md`에 `ModelInfo.type` 결정 기준 명시.

---

### **[INFO] 모델 목록 로드 성공 후 기존 선택값 유효성 재검증 정책 미정의**
- **위치**: requirement/review.md (2026-04-24_08-20-33)
- **상세**: 새 모델 목록이 로드됐을 때 기존 `value`(선택된 모델명)가 새 목록에 없는 경우(provider 변경 후 재로드 등) `onChange('')`를 호출할지 undefined 동작으로 남길지 요구사항이 없다. 현재 구현은 `value`를 그대로 유지해 선택된 모델이 실제 목록에 없는 상태가 됨.
- **제안**: 스펙에 "기존 선택값이 새 목록에 없으면 초기화한다/유지한다" 명시.

---

### **[INFO] `apiKey` 빈 문자열 허용 범위가 DTO-서비스 레이어 간 분산**
- **위치**: api_contract/review.md, requirement/review.md (2026-04-24_08-16-06)
- **상세**: DTO는 모든 provider에서 `apiKey: ''`를 허용하고 서비스 레이어에서 비로컬 provider의 빈 apiKey를 거부한다. Swagger 문서에 "local 이외는 빈 값 거부(`LLM_CREDENTIALS_REQUIRED`, 400)"가 미명시되어 API 소비자가 400 원인을 파악하기 어렵다. 기능적으로는 동작하나 계약 명확성이 부족하다.
- **제안**: `@ApiProperty.description`에 provider별 apiKey 필수/선택 조건 명시.

---

### **[INFO] Anthropic `listModels` 모델 수 상한 없음**
- **위치**: concurrency/review.md, dependency/review.md (2026-04-24_08-11-00)
- **상세**: Google 클라이언트는 `MAX_MODELS = 100` 상한이 있으나 Anthropic 클라이언트는 없다. "모델 목록은 최대 N개까지 반환한다"는 요구사항이 없어 두 클라이언트 간 동작이 비일관적이다. Anthropic이 향후 대량 모델을 반환하면 30초 타임아웃까지 블록된다.
- **제안**: 요구사항에 "모델 목록 최대 반환 수(예: 100)" 명시 후 모든 클라이언트에 동일하게 적용.

---

## 요약

이번 변경의 핵심 요구사항(저장 전 자격증명으로 LLM 모델 목록 실시간 조회, chat-only 필터, create/edit 플로우 분기)은 4라운드 리뷰를 거치며 대부분 구현된 것으로 확인된다. 그러나 **SSRF 방어 범위(local 프로바이더 예외, IPv6, 0.0.0.0)**가 스펙에 명시되지 않은 채 구현으로만 결정된 것이 가장 큰 요구사항 추적성 문제다. Google SDK 마이그레이션 과정에서 **토큰 usage fallback 제거**와 **embed() 배치 silent failure** 두 가지가 과금·데이터 정확성 요구사항에 영향을 줄 수 있음에도 검증이 없다. provider 변경 시 모델 목록 초기화 정책과 선택값 유효성 재검증 정책이 구현 수준에서만 결정되어 있어 향후 유지보수 시 기준이 없다.

## 위험도

**MEDIUM** — SSRF 방어 범위와 Google SDK 마이그레이션의 과금 데이터 영향이 스펙 레벨 결정 없이 구현으로만 확정된 상태. 기능 동작 자체는 대부분 정상이나 요구사항-구현 간 추적성이 부족하다.