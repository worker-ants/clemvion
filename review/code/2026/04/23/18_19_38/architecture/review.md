### 발견사항

---

**[INFO] TypeScript 타입 캐스팅 정리 (다수 파일)**
- 위치: `.spec.ts` 전반, `execution-engine.service.ts`, `ai-agent.handler.ts` 등
- 상세: `as unknown as T` 패턴 제거가 대부분. 타입 시스템이 실제 타입을 올바르게 추론하도록 개선. 아키텍처에 영향 없음.
- 제안: 없음 (양호)

---

**[INFO] Google SDK 마이그레이션: stateful → stateless**
- 위치: `google.client.ts`
- 상세: `@google/generative-ai` → `@google/genai` 교체. `startChat()` + `sendMessage()` 세션 방식에서 `generateContent(contents[])` 무상태 방식으로 전환. 아키텍처적으로 더 깔끔하고 서버사이드 세션 상태를 제거함.
- 제안: 없음. 단, 스트리밍에서 `result.response`(aggregated) fallback이 제거됨 — 아래 WARNING 참조.

---

**[WARNING] 스트리밍 usage 데이터 fallback 제거**
- 위치: `google.client.ts` (구 `result.response` aggregated 블록)
- 상세: 구 SDK는 스트림 청크에 `usageMetadata`가 없을 경우 `result.response`에서 한 번 더 조회하는 fallback이 있었음. 신 SDK 마이그레이션에서 이 경로가 제거됨. 신 `@google/genai` SDK가 마지막 청크에 usage를 항상 포함한다면 무해하지만, 일부 모델·버전에서 누락될 경우 `totalTokens === 0` 상태가 조용히 발생할 수 있음.
- 제안: 신 SDK의 스트림 청크 usage 포함 보장 여부를 실제 Gemini 2.5+ 모델로 검증. 보장되지 않는다면 마지막 청크 집계 로직을 유지해야 함.

---

**[WARNING] `LlmService.previewModels`의 과도한 단일 메서드 책임**
- 위치: `llm.service.ts:178~244`
- 상세: 한 메서드가 ① 입력 유효성 검사, ② 팩토리 에러 처리, ③ API 호출 + 타임아웃, ④ 에러 sanitize/재throw 를 모두 담당. 현재 규모에서는 관리 가능하지만, 프로바이더별 preview 로직이 추가될 경우 확장이 어려워짐. `withTimeout`을 private으로 추출한 것은 좋은 방향이나 shared 유틸리티 모듈로 옮길 여지가 있음.
- 제안: 당장은 허용 가능. 프로바이더별 분기가 생긴다면 `previewModels` 내 팩토리 생성 에러 처리를 별도 메서드로 분리 검토.

---

**[INFO] 프론트엔드 API 응답 언래핑 방어 패턴**
- 위치: `frontend/src/lib/api/llm-configs.ts`
- 상세: `(data?.data ?? data)` 패턴이 `listModels`와 `previewModels` 양쪽에 추가됨. 이는 transform interceptor가 `{ data: [...] }`로 감싸는 백엔드 응답과 직접 배열을 반환하는 경우를 모두 방어하는 것. 인터셉터 적용 범위가 일관되지 않음을 시사.
- 제안: 백엔드 transform interceptor 적용 대상 범위를 명확히 정의하거나, 프론트엔드에서 통일된 unwrapping 유틸리티를 사용하는 것이 나음.

---

**[INFO] `POST /preview-models` 라우트 위치**
- 위치: `llm-config.controller.ts:148`
- 상세: NestJS는 정적 경로를 동적 경로(`:id`)보다 우선 처리하므로 `POST /preview-models`가 `POST /:id/test`와 충돌하지 않음. 단, `preview-models`가 컨트롤러 내에서 `:id` 의존 라우트들보다 앞에 정의된 것이 중요 — 현재 순서(148번)가 올바름.
- 제안: 없음. 현재 배치 적절.

---

**[INFO] `ModelCombobox`가 `apiKey`를 직접 prop으로 수신**
- 위치: `frontend/src/app/(main)/llm-configs/page.tsx`
- 상세: 평문 API key가 페이지 → 컴포넌트 → API 호출 체인을 통해 전달됨. 컴포넌트 로그나 React DevTools에서 노출 가능. 기능적으로는 설계 의도대로이나, 컴포넌트 인터페이스가 보안 민감 데이터를 직접 받는 것을 팀 컨벤션으로 문서화할 것.
- 제안: 없음 (허용 가능). `ModelCombobox` 구현에서 apiKey를 로컬 상태나 ref 외부로 노출하지 않는지 확인 필요.

---

**[INFO] 모델 목록 동적 조회 — 캐싱 없음**
- 위치: `anthropic.client.ts`, `google.client.ts`, `llm.service.ts`
- 상세: 하드코딩 목록 제거 후 매 요청마다 프로바이더 API를 호출. Throttle(10/60s)로 남용을 제한하지만, 저장된 설정의 `GET /llm-configs/:id/models`에는 별도 캐싱이 없어 동일 사용자가 UI를 자주 열면 불필요한 외부 API 호출이 발생.
- 제안: 저장된 설정 기반 모델 목록에 단기 메모리 캐시(TTL ~5분) 추가 검토. preview는 캐시 불필요.

---

### 요약

이번 변경의 핵심은 두 가지다: ① 전반적인 TypeScript 타입 캐스팅 정리(대부분의 diff)와 ② `preview-models` 기능 추가 및 Google SDK 마이그레이션. 아키텍처 관점에서 `preview-models`는 기존 Factory 패턴을 올바르게 재사용하고, 레이어 분리(DTO 유효성 검사 → Service 비즈니스 로직 → Controller 라우팅)가 적절히 유지된다. Google SDK 마이그레이션은 stateful 세션에서 stateless API 호출로의 전환으로 서버 아키텍처를 단순화했으나, usage fallback 제거와 모델 목록 캐싱 부재는 운영 환경에서 검증이 필요하다. 전반적으로 기존 아키텍처 경계를 잘 준수한 변경이다.

### 위험도

**LOW**