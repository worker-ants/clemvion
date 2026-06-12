# 요구사항(Requirement) Review

**대상 파일**
- `codebase/backend/src/nodes/data/code/code.handler.ts`
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts`

**관련 spec**
- `spec/4-nodes/5-data/2-code.md`
- `spec/conventions/node-output.md`
- `spec/conventions/error-codes.md`

---

## 발견사항

### [INFO] [SPEC-DRIFT] `meta.durationMs` 핸들러 미포함 — spec §5.1 JSON 예시와 괴리

- **위치**: `code.handler.ts` — `execute()` 반환 블록 (성공·실패 양 경로), `code.handler.spec.ts` — 출력 assertion 전반
- **상세**: spec §5.1·§5.3 의 JSON 예시는 `meta.durationMs` 를 포함하고 있다. 그러나 spec 본문 표에서 `meta.durationMs` 의 출처(source)가 **"engine inject"** 로 명기돼 있으며(`§5.1 필드 표`, `§5.3 공통 필드 표`), `§5.3.3` 주석에도 "핸들러는 `meta: { success, logs }` 만 반환하고 엔진이 실행 시간을 덧붙인다" 고 명시돼 있다. 코드는 이 계약을 그대로 이행한다 — 핸들러는 `meta: { success, logs }` 만 반환하고 `durationMs` 를 포함하지 않는다. spec JSON 예시는 엔진 주입 후 최종 형태를 보여주는 것으로 해석된다.  
  테스트 코드도 `meta.durationMs` 를 단언하지 않아 일관성은 있으나, spec §5.1 JSON 예시의 `durationMs` 포함 여부를 "엔진 주입 후 최종 형태 예시" 임을 표 각주·JSON 블록 근처에 명확히 표기하지 않아 구현자가 헷갈릴 여지가 있다.
- **제안**: 코드 유지. spec `§5.1` 의 JSON 예시 위 또는 표의 `meta.durationMs` 출처 컬럼("engine inject") 에 "위 JSON 예시는 엔진 주입 후 최종 형태; 핸들러 반환값은 `meta: { success, logs }` 만 포함" 이라는 주석을 추가. 대상: `spec/4-nodes/5-data/2-code.md §5.1` `meta.durationMs` 표 행 · JSON 예시 블록.

---

### [INFO] 메모리 제한 환경 변수 추출 미완성 작업 주석 (W15)

- **위치**: `code.handler.ts` 라인 17–18 — `ISOLATE_MEMORY_LIMIT_MB` 상수 주석
- **상세**: `W15: Currently hardcoded. Can be extracted to \`CODE_NODE_MEMORY_LIMIT_MB\` env var if runtime tuning is needed.` 라는 future-work 주석이 존재한다. 코드상 TODO/FIXME 키워드는 아니지만 미완성·추후 작업을 시사한다. 현재 값 `128` 은 spec §7.2 에 명시된 하드 리밋과 일치하므로 기능 동작은 올바르다.
- **제안**: 현재 동작은 spec과 일치. W15 주석은 정보성이므로 기능 관점 조치 불필요. 다만 향후 환경 변수 추출이 계획이면 `plan/` 에 트래킹 이슈 등록 권장.

---

### [INFO] 런타임 에러 라인 오프셋(+3) — 표시 계층 미구현

- **위치**: `code.handler.ts` 라인 168 — `W14` 주석, `spec/4-nodes/5-data/2-code.md §4 step2`
- **상세**: spec §4 step2 에 "런타임 에러 라인 오프셋 +3 — 표시 계층은 3을 빼 사용자 실제 라인으로 환산한다" 가 명기돼 있다. 핸들러는 이 오프셋을 문서화(W14 주석)하고 있지만 **핸들러 자체는 조정하지 않으며**, 에러 메시지를 그대로 `output.error.message` 에 담는다. 라인 번호 보정은 "표시 계층(UI/frontend)" 의 책임임을 spec이 명시하므로 핸들러 동작은 spec 계약과 일치한다.
- **제안**: 핸들러 코드 유지. 프론트엔드 렌더링 계층에서 -3 보정이 실제로 구현돼 있는지 별도 검증 권장.

---

### [INFO] `$helpers.base64.decode` 잘못된 Base64 입력 시 묵시적 실패 — spec 미정의

- **위치**: `code.handler.ts` 라인 426–429, `code.handler.spec.ts` 라인 1170–1180
- **상세**: `Buffer.from(String(data), 'base64').toString('utf-8')` 는 잘못된 Base64 문자열을 조용히 partial decode 하거나 빈 문자열을 반환한다. spec §2.2 `$helpers.base64.decode` 정의는 이 에러 동작을 명시하지 않는다. 테스트는 "silent return string" 으로 문서화하고 있다. spec 본문이 침묵하는 영역이므로 INFO.
- **제안**: 현재 동작(silent decode) 유지. spec §2.2 `$helpers.base64.decode` 표에 "잘못된 입력은 Node.js Buffer의 best-effort 디코딩 결과 반환 (예외 없음)" 주석 추가 권장 — 사용자 기대를 명확히 하기 위함.

---

### [INFO] `$vars` copy-out 실패 시 성공 포트 반환 + 변수 미갱신 — spec 명확화 여지

- **위치**: `code.handler.ts` 라인 483–497
- **상세**: `jail.get('$vars', { copy: true })` 가 실패하면(직렬화 불가 값 할당) 핸들러는 `varsClone` 을 복원하고 **`port: 'success'` 로 계속 반환**한다. spec §4.6 step6은 "copy-out 이 실패하면 varsClone 으로 복원 — 원본 보존" 으로 기술하나, 이 경우에도 `port: 'success'` 를 유지하는 것이 옳은지(즉 사용자 코드의 return값은 여전히 성공으로 전달하는지)를 spec이 명시하지 않는다. 테스트(라인 1046–1049)는 `port: 'success'` + 변수 미갱신 조합을 정답으로 검증하고 있으며 구현은 일관성이 있다.
- **제안**: 코드 동작과 테스트는 일치. spec §4.5 copy-out 실패 섹션에 "사용자 코드 자체의 return 값은 정상 출력되며 포트는 `success` 유지 — 변수만 스냅샷으로 복원" 을 명시하면 모호성 해소 가능.

---

### [INFO] timeout 엣지 케이스 — `timeoutMs + 1000` wall-clock 가드 의도 미 문서화

- **위치**: `code.handler.ts` 라인 478 — `setTimeout(…, timeoutMs + 1000)`
- **상세**: 외부 wall-clock 타임아웃을 `timeoutMs + 1000` ms 로 설정한다. isolated-vm CPU 타임아웃(timeoutMs)이 먼저 발동하도록 1000ms 여유를 두는 이중 타임아웃 설계다. spec §7.2 "이중 적용" 언급은 있으나 +1000ms 버퍼 값의 근거가 spec에 없다. 동작은 올바르며 spec 침묵 영역이다.
- **제안**: 코드 주석(존재함 — 라인 462 "dual timeout" 설명)으로 이미 충분히 설명됨. 추가 조치 불필요.

---

### [INFO] `hostHash` 허용 알고리즘 목록 — spec §2.2 와 완전 일치

- **위치**: `code.handler.ts` 라인 51–57 — `ALLOWED_HASH_ALGORITHMS`
- **상세**: `sha256`, `sha384`, `sha512`, `sha1`, `md5` 5개. spec §2.2 `$helpers.crypto.hash` 표의 "허용 알고리즘: `sha256` · `sha384` · `sha512` · `sha1` · `md5`" 와 정확히 일치. 문제 없음.

---

### [INFO] 테스트 — `classifyCodeNodeError` 스포핑 방어 테스트 의도 주석 오류

- **위치**: `code.handler.spec.ts` 라인 1456–1469 — "spoofing prevention" 테스트
- **상세**: 테스트 주석에 "The key assertion: priority-2 (isDisposed flag) is NOT triggered" 라고 쓰여 있지만, 결과는 `EXECUTION_MEMORY_EXCEEDED` 다. 이는 priority-3(message regex) 가 `"Isolate was disposed"` 문자열을 캐치해 동일 결과를 반환하기 때문이다. 주석이 "priority-2 는 발동하지 않지만 regex fallback 이 동일 코드를 반환한다" 고 설명하고 있어 기능은 올바르다. 그러나 이 테스트는 "user throws 'Isolate was disposed' message → regex 패스스루로 MEMORY_EXCEEDED" 라는 동작을 pin 하므로, 사용자가 스포핑으로 `CODE_MEMORY_LIMIT` 를 의도적으로 유발할 수 있는 셈이다. spec §5.3.3 이나 §7 에서 이를 보안 이슈로 취급하는지 여부는 언급 없음.
- **제안**: 현재 동작은 spec이 권위로 정의하지 않는 영역. "사용자가 `Isolate was disposed` 를 throw 해 `CODE_MEMORY_LIMIT` 를 유발할 수 있다" 는 게임 이론적으로 문제가 없는지 확인 필요. 만약 문제라면 `CODE_RUNTIME_ERROR` 로 fallback 시켜야 할 수 있다. 현재 코드는 최소한 **실제 isolate 폐기**(isDisposed 플래그)와 **사용자 메시지 스포핑**은 구별하고 있다.

---

## 요약

코드는 spec `4-nodes/5-data/2-code.md` 의 핵심 요구사항을 높은 충실도로 구현하고 있다. 설정 필드(`language`, `code`, `timeout`), 실행 컨텍스트 변수(`$input`, `$vars`, `$execution`, `$node`, `$helpers`), 이중 타임아웃, 128MB 메모리 하드 리밋, 에러 코드 정규화 매핑(`LEGACY_TO_NORMALIZED`), `$vars` 원자적 교체·롤백, pre-flight 구문 검사, `port: 'success'`/`port: 'error'` 분기, config echo(Principle 7), deprecated `meta.error`/`meta.errorCode`/`meta.stack` 제거, dayjs 힙 스냅샷 최적화 경로와 fallback 경로가 모두 명세에 부합하게 구현돼 있다. 발견된 사항은 모두 INFO 수준이며, 대부분은 spec 본문에 침묵하는 영역이거나 엔진 주입 계층의 책임 경계에 관한 것이다. 코드를 수정할 버그나 spec 위반은 발견되지 않았다.

## 위험도

NONE
