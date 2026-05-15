## 발견사항

---

**[WARNING] `lastError` 타입이 `Record<string, unknown>`으로 과도하게 느슨함**
- 위치: `integration-response.dto.ts` — `lastError` 필드
- 상세: `{ code, message, at }` 구조가 주석에 명시되어 있음에도 TS 타입이 `Record<string, unknown>`으로 선언되어 있어, 소비 측(프론트엔드 등)에서 타입 안전성이 없음. 런타임 오류가 컴파일 타임으로 올라오지 않는다.
- 제안:
  ```ts
  lastError?: { code: string; message: string; at: string } | null;
  ```

---

**[WARNING] `status: string`에 enum 정보가 ApiProperty에만 존재 — 컴파일 타임 타입 안전성 부재**
- 위치: `integration-response.dto.ts` — `status` 필드
- 상세: `@ApiProperty({ enum: ['connected', 'expired', 'error', 'pending_install'] })`로 허용값이 문서화되어 있으나, 실제 TS 타입은 `string`이라 잘못된 상태값을 DTO로 반환해도 컴파일러가 잡지 못함. `IntegrationStatus` 유니온 타입 또는 enum이 엔티티에 이미 존재할 텐데 DTO에서 재사용하지 않고 있다.
- 제안: 엔티티의 `IntegrationStatus` 타입을 DTO에도 재사용하거나, 별도 `IntegrationStatusDto` 유니온 타입을 선언.

---

**[WARNING] 매직 스트링 `'OAUTH_CALLBACK_FAILED'`**
- 위치: `integrations.controller.ts` — catch 블록 내 `const errorCode = e.response?.code ?? 'OAUTH_CALLBACK_FAILED'`
- 상세: 하드코딩된 fallback 에러 코드. 같은 코드가 서비스 레이어에서도 사용된다면 sync가 깨질 수 있고, 오탈자 검출도 불가.
- 제안: 공유 상수 파일(`integration-error-codes.ts` 등)에 `OAUTH_CALLBACK_FAILED` 상수를 정의하고 참조.

---

**[WARNING] 매직 넘버 `4000` (ms)**
- 위치: `oauth-callback.template.ts` — `'setTimeout(function(){ window.close(); }, 4000);'`
- 상세: 에러 팝업 auto-close 지연값이 하드코딩됨. 테스트에서는 `>= 1000ms`를 검증하는데, 실제값이 달라지면 테스트가 여전히 통과하면서 UX 의도는 바뀔 수 있음.
- 제안: `POPUP_ERROR_CLOSE_DELAY_MS = 4000` 상수를 모듈 내 추출하거나, 테스트도 정확한 값(`4000`)을 검증하도록 변경.

---

**[WARNING] 인라인 익명 에러 타입 캐스팅**
- 위치: `integrations.controller.ts` — `const e = err as { message?: string; response?: { message?: string; code?: string } }`
- 상세: 익명 인터페이스를 catch 블록마다 인라인으로 정의하는 패턴. 동일 패턴이 이미 이전 코드에 있었고, 이번에 `code?: string`을 추가하면서 확장됨. 같은 타입이 서비스/컨트롤러에서 중복 선언될 위험이 있다.
- 제안: `HttpException`-like 에러 타입을 공유 인터페이스(`integration-error.types.ts`)로 추출.

---

**[INFO] `"install_timeout"` 매직 스트링**
- 위치: `status-badge.tsx` — `integration.statusReason === "install_timeout"`
- 상세: DB `status_reason` 컬럼의 허용값이 프론트엔드에서 리터럴 스트링으로 비교됨. 백엔드 상수 변경 시 프론트엔드가 조용히 오동작한다.
- 제안: 공유 타입 패키지가 있다면 `StatusReason` 상수/유니온으로 관리. 없다면 프론트엔드 로컬 상수라도 추출.

---

**[INFO] 테스트 정규식 복잡도**
- 위치: `oauth-callback.template.spec.ts` — `html.match(/setTimeout\([^,]+,\s*(\d+)\s*\)/)`
- 상세: 테스트 의도(지연 시간 추출)가 정규식 패턴에 묻혀 있음. 향후 template 포맷이 바뀌면 정규식이 실패 이유를 파악하기 어렵다.
- 제안: 상수를 template에서 export하고 테스트에서 직접 import해 값을 검증하는 것이 더 유지보수하기 쉬움. 또는 최소한 정규식에 설명 주석 추가.

---

**[INFO] WHAT 주석**
- 위치: `oauth-callback.template.spec.ts` — `// No setTimeout wrapping the close call on success.`
- 상세: 코드가 이미 `expect(html).not.toMatch(...)` 로 명시하고 있는 내용을 재서술한다. CLAUDE.md 규약에서 금지하는 WHAT 주석.
- 제안: 주석 제거. 바로 아래 `expect`가 의도를 충분히 설명함.

---

## 요약

코드 변경의 핵심 로직(callback 실패 시 `pending_install` 상태 보존, `lastError`/`statusReason` 기록, popup auto-close 지연)은 명확하게 구현되어 있고, WHY를 설명하는 주석도 적절하게 사용됨. 주요 유지보수성 위험은 두 곳에 집중된다: (1) `lastError`의 느슨한 타입과 `status`의 컴파일타임 타입 안전성 부재로 인해 DTO 계약이 코드 수준에서 강제되지 않으며, (2) `'OAUTH_CALLBACK_FAILED'`, `"install_timeout"`, `4000` 등 매직 값들이 컨트롤러·프론트엔드·템플릿에 산재해 있어 관련 값 변경 시 누락 위험이 있다. 인라인 에러 타입 캐스팅 패턴도 중복 선언으로 번질 소지가 있어 공유 타입으로 추출하는 것이 좋다.

## 위험도

**LOW** — Critical/Warning 항목 모두 즉각적인 기능 버그보다는 향후 확장 시 불일치 위험에 해당하며, 현재 동작에는 지장 없음.