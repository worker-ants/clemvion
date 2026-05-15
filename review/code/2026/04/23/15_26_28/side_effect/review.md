## Side Effect Code Review

### 발견사항

---

**[WARNING]** `preview-models` 엔드포인트에 워크스페이스 격리 없음
- 위치: `llm-config.controller.ts:186` — `previewModels` 메서드
- 상세: 다른 엔드포인트(`findAll`, `findOne`, `update` 등)는 모두 `@WorkspaceId()` 데코레이터로 워크스페이스 범위를 적용하지만, `previewModels`는 적용하지 않는다. 인증된 editor 권한 사용자라면 워크스페이스 구분 없이 호출 가능하다. 현재 이 엔드포인트는 완전히 stateless(DB 읽기/쓰기 없음)하므로 데이터 누출 위험은 없다. 그러나 향후 요청 감사(audit log) 또는 워크스페이스별 rate limit을 도입할 때 일관성이 깨질 수 있다.
- 제안: 의도적 설계임을 주석으로 명시하거나, 감사 목적으로 `@WorkspaceId()`를 받아두되 격리 로직에는 사용하지 않는 형태로 남겨두는 것을 검토.

---

**[WARNING]** factory 생성 오류 메시지가 `sanitizeErrorMessage` 없이 클라이언트에 노출됨
- 위치: `llm.service.ts` — `previewModels` 내 첫 번째 `catch` 블록
- 상세: `listModels()` 실패 경로는 `sanitizeErrorMessage(message)` 를 거쳐 반환하지만, `clientFactory.create()` 실패 경로는 원본 `error.message`를 그대로 `BadRequestException`에 담아 반환한다. 현재 factory는 `"Unsupported provider: X"`, `"Azure OpenAI requires a base URL"` 수준의 메시지만 throw하므로 안전하지만, 향후 factory 구현이 변경되어 더 상세한 내부 정보(엔드포인트 URL, 스택 트레이스 파생 메시지 등)를 메시지에 포함하면 클라이언트에 노출될 수 있다.
- 제안: factory 오류도 `sanitizeErrorMessage`를 거치거나, factory 오류는 별도의 허용 메시지 목록(allowlist)으로 제한.

---

**[INFO]** `previewModels` 의 `logger.warn` 이 원본(비sanitize) 메시지를 로깅함
- 위치: `llm.service.ts` — `previewModels` 두 번째 `catch` 블록
- 상세: `this.logger.warn(\`LLM preview models failed: ${message}\`)` 에서 `message`는 sanitize 이전 원본이다. 스펙 §5.4 의 "apiKey는 로그에 기록하지 않는다" 요건은 충족하지만(API key가 provider 에러 메시지에 포함되지 않는 것이 일반적), provider 응답이 비정상적으로 URL·토큰 힌트를 에러 메시지에 포함할 경우 서버 로그에 남는다.
- 제안: 현재 수용 가능한 수준이나, 로그 레벨을 `debug`로 낮추거나 sanitize된 메시지를 함께 기록하는 것을 고려.

---

**[INFO]** `listModels` API 응답 언래핑 수정 — 기존 동작 변경
- 위치: `frontend/src/lib/api/llm-configs.ts:73`
- 상세: `return data as ModelInfo[]` → `return (data?.data ?? data) as ModelInfo[]` 변경. 이는 기존 버그 수정이지만, `listModels`를 직접 호출하던 다른 위치(현재 코드베이스에서 `ModelCombobox` 하나만 사용하는 것으로 보임)는 영향을 받는다. 수정 방향은 올바르다.
- 제안: `previewModels`도 동일한 패턴(`data?.data ?? data`)을 이미 적용하고 있어 일관성 확보됨. 문제 없음.

---

**[INFO]** `ModelCombobox` — 재시도 실패 시 이전 로드 결과 삭제
- 위치: `model-combobox.tsx` — `onError` 핸들러
- 상세: 모델 목록을 성공적으로 불러온 뒤 재로드 시도 중 오류가 발생하면 `setModels([])` 로 기존 목록이 초기화된다. 사용자가 이미 datalist에서 선택했던 모델 값(`value` state)은 유지되지만, 다음 클릭을 위한 드롭다운 옵션은 사라진다.
- 제안: UX 차원이며 기능상 치명적이지 않음. 오류 시 기존 목록을 유지하는 방향도 고려 가능.

---

### 요약

이번 변경은 저장 전 폼 자격증명으로 provider 모델 목록을 미리 조회하는 `preview-models` 기능을 추가한다. 핵심 보안 요건인 캐시 우회(per-config 캐시에 임시 클라이언트 저장 안 함), API key 비영속화, 오류 sanitize는 모두 올바르게 구현되어 있다. 발견된 이슈는 워크스페이스 격리 부재(stateless 엔드포인트이므로 현재는 무해)와 factory 오류 메시지의 partial sanitize 누락 두 가지이며, 미래 확장 시 위험이 될 수 있어 대응을 권장한다. 전반적 구현 품질은 양호하다.

### 위험도

**LOW**