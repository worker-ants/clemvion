## Scope Code Review

### 발견사항

---

**[WARNING] 타입 캐스트 정리가 기능 변경과 대규모로 혼재**
- 위치: 파일 2~16, 18, 29~40 (약 20개 이상 파일, spec 파일 위주)
- 상세: `as unknown as T`, `as any`, `as never` 제거가 `previewModels` 기능 추가 및 Google SDK 마이그레이션과 같은 PR에 묶여 있음. 이 정리는 기능적으로 독립적인 변경으로, 스펙 변경과 분리하면 리뷰 시 인과관계 추적이 어려워짐.
- 제안: 타입 캐스트 정리는 별도 PR로 분리하거나, 최소한 커밋을 분리해 리뷰어가 기능 관련 변경만 집중할 수 있게 할 것.

---

**[WARNING] Google 클라이언트 주석 대량 삭제**
- 위치: `google.client.ts` (파일 23) 전반
- 상세: Gemini API의 비직관적 동작을 설명하는 중요 주석들이 삭제됨. 예시:
  - `functionResponse`가 `role:'user'`에 들어가면 400 에러가 발생하는 이유
  - `thoughtSignature` echo가 필요한 이유
  - `Gemini ObjectSchema.properties`가 비면 거부하는 이유
  - `aggregated response` fallback 로직의 제거 이유
  
  이 내용들은 `CLAUDE.md` 규약 ("WHY가 비자명한 경우에만 주석")에 해당하는 사례로, 삭제 시 미래 유지보수자가 같은 실수를 반복할 위험이 있음.
- 제안: Gemini SDK 특유의 quirk(역할 제약, signature echo, 빈 properties 처리)에 대한 주석은 유지할 것.

---

**[INFO] `Server` 임포트 제거 (범위 외 정리)**
- 위치: `websocket.gateway.spec.ts` (파일 32), 1번째 줄
- 상세: `import { Socket, Server } from 'socket.io'` → `import { Socket } from 'socket.io'`. 기능과 무관한 미사용 임포트 정리.
- 제안: 허용 가능한 수준이나 기록해둠.

---

**[INFO] `transformIgnorePatterns` 변경 (파일 1)**
- 위치: `backend/package.json`, Jest 설정
- 상세: pnpm 가상 스토어 경로(`node_modules/.pnpm/...`)를 고려한 정규식으로 변경. `@google/genai` 패키지 추가에 따른 pnpm 환경 대응으로 보이며 기술적으로 타당함.
- 제안: 변경 의도를 커밋 메시지나 주석으로 명시하면 명확성 향상.

---

**[INFO] `aggregated response fallback` 로직 제거 (파일 23)**
- 위치: `google.client.ts`, `stream()` 메서드 끝부분
- 상세: 구 SDK에서 스트림 청크에 `usageMetadata`가 없을 때 `result.response` Promise에서 재시도하는 로직이 신 SDK 마이그레이션으로 함께 삭제됨. 신 SDK(`@google/genai`)에서 이 fallback이 불필요한지 명시적 검증이 없음.
- 제안: 신 SDK에서 usage 정보가 항상 스트림 청크에 포함됨을 테스트로 검증하거나 주석으로 근거를 남길 것.

---

### 요약

이번 변경의 핵심 범위는 (1) `previewModels` 기능(미저장 자격증명으로 모델 목록 실시간 조회), (2) Anthropic·Google의 하드코딩 모델 목록 → 라이브 API 조회 전환, (3) Google SDK `@google/generative-ai` → `@google/genai` 마이그레이션으로 명확히 정의된다. 그러나 20개 이상 파일에 걸친 타입 캐스트 정리(`as unknown as T` 제거)가 기능 변경과 혼재되어 있어 리뷰 부담이 크게 증가했고, Google 클라이언트의 중요 "WHY" 주석이 상당수 삭제되어 향후 유지보수 비용이 올라갈 우려가 있다. 기능 자체(SSRF 가드, 타임아웃, 에러 sanitize, Rate limit)는 스펙을 충실히 따르고 있으며 범위를 벗어난 기능 추가는 없다.

### 위험도

**LOW**