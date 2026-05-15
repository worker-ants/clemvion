### 발견사항

**[WARNING] `local` 프로바이더의 SSRF 가드 미적용**
- 위치: `llm.service.ts` `previewModels()` — SSRF 가드 조건
- 상세: `params.provider !== 'local'` 조건으로 인해 `local` 프로바이더는 `isPrivateHost` 검사를 완전히 우회한다. editor 권한 사용자가 `local` 프로바이더로 `baseUrl: 'http://10.0.0.5:11434'` 등 RFC1918 내부 주소를 지정해 내부 서비스를 탐색할 수 있다.
- 제안: `local` 프로바이더에 대해서도 localhost/127.x.x.x 만 허용하도록 별도 검사 추가, 또는 주석으로 "내부 서비스 배포(Kubernetes 내 Ollama) 지원을 위해 의도적으로 허용" 명시

**[WARNING] `isPrivateHost` — IPv6 사설 대역 및 IPv4-mapped IPv6 미차단**
- 위치: `llm.service.ts` `isPrivateHost()` 함수
- 상세: `::ffff:10.0.0.1`(IPv4-mapped IPv6), `fc00::/7`(unique local), `fe80::/10`(link-local) 등 IPv6 사설 대역이 차단되지 않는다. `::1`, `[::1]` 만 명시적으로 처리한다.
- 제안: IPv6 사설 대역 패턴을 추가하거나, URL 파싱 라이브러리로 대체

**[WARNING] DNS rebinding/리졸빙 기반 SSRF 미차단 — 설계상 의도이나 문서화 필요**
- 위치: `llm.service.ts` 주석 ("DNS 이름은 해석 비용상 제외")
- 상세: `internal-service.company.com`처럼 DNS로 사설 IP를 가리키는 hostname은 통과한다. 주석으로 한계를 인정하나, 스펙 문서(§5.5)에는 이 제한이 명시되지 않았다.
- 제안: `spec/5-system/7-llm-client.md` §5.5 에러 처리 섹션에 "DNS 이름 기반 SSRF는 IP 리터럴 검사만 수행" 한계 명시

**[WARNING] `PreviewLlmModelsDto` 구현 파일이 diff에 없음**
- 위치: 파일 50(`preview-llm-models.dto.spec.ts`)은 존재하나 `preview-llm-models.dto.ts` 구현 파일은 diff 미포함
- 상세: 컨트롤러가 이미 임포트(`import { PreviewLlmModelsDto }`)하므로 파일은 존재하지만, `@ValidateIf`(azure/local → baseUrl 필수), `@IsUrl`(file:// 차단), `@MaxLength(500)` 등 검증 로직이 테스트 기대값과 일치하는지 확인 불가
- 제안: 리뷰 대상에 `preview-llm-models.dto.ts` 포함 요청

**[WARNING] `ModelCombobox` 컴포넌트 구현 미포함**
- 위치: `frontend/src/app/(main)/llm-configs/page.tsx` — `ModelCombobox` import
- 상세: 스펙에서 요구하는 "수정 플로우에서 apiKey 비워둔 경우 `/llm-configs/:id/models` 사용, 재입력 시 preview 엔드포인트 사용", "chat 모델만 필터" 로직이 구현되어 있는지 확인 불가
- 제안: `frontend/src/components/llm-config/model-combobox.tsx` diff 추가 요청

**[INFO] `isPrivateHost` 함수 위치 — import 문 사이에 삽입**
- 위치: `llm.service.ts` L1~L30
- 상세: `isPrivateHost` 함수가 import 블록 중간에 삽입되어 있다. TypeScript에서 컴파일상 문제없으나 lint 규칙(`import/first`)에서 경고가 발생할 수 있고 가독성이 저하된다.
- 제안: 함수를 모든 import 이후로 이동

**[INFO] Google 클라이언트 `embed()` 배치 방식 변경 — 응답 형식 검증 필요**
- 위치: `google.client.ts` `embed()` 메서드
- 상세: 기존 `embedContent(text)` per-text 루프에서 `embedContent({ contents: texts })` 단일 배치 호출로 변경. 신 SDK(`@google/genai`)의 `response.embeddings[].values` 형식을 spec 테스트 없이 `?? []` fallback으로만 처리하고 있다. 빈 배열 fallback은 임베딩 결과 누락을 조용히 삼킬 수 있다.
- 제안: `embed()` 테스트에 배치 응답 형식 확인 케이스 추가

**[INFO] `listModels` 기존 `/:id/models` 에러 처리 개선**
- 위치: `llm.service.ts` `listModels()` (기존 메서드)
- 상세: 기존 `listModels`도 `withTimeout` + `sanitizeErrorMessage`로 개선되었다. 이 변경이 기존 동작과 하위호환인지 확인 필요 (기존에는 에러를 그대로 throw했음)

---

### 요약

이번 변경의 핵심은 저장 전 자격증명으로 LLM 모델 목록을 조회하는 `previewModels` 기능 추가와 Google AI SDK 마이그레이션(`@google/generative-ai` → `@google/genai`)이다. 타입 단언(`as unknown as T`) 제거 등 타입 안전성 개선은 긍정적이며, SSRF 가드·Rate limit·30초 타임아웃·AbortSignal 전달 등 보안 요구사항도 대부분 반영되었다. 다만 `local` 프로바이더에 대한 SSRF 가드 예외, IPv6 사설 대역 미차단, 핵심 구현 파일(`PreviewLlmModelsDto`, `ModelCombobox`) 부재 등으로 인해 요구사항 전체 충족 여부를 확인하기 어려운 상태다.

### 위험도

**MEDIUM**