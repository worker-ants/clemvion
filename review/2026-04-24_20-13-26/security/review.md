### 발견사항

---

**[WARNING] Expression 위젯 — 서버 사이드 템플릿/코드 인젝션 가능성**
- 위치: `switch.schema.ts` — `switchValue` (widget: 'expression'), `send-email.schema.ts` — `subject`, `body` (widget: 'expression')
- 상세: `{{ $input.value }}` 와 같은 expression 문법이 서버 측 템플릿 엔진에서 평가될 경우, 사용자가 입력하는 값이 런타임에 실행될 수 있음. 스키마 레이어에는 expression 문자열의 형식·깊이 제한이 없어 SSTI(Server-Side Template Injection) 또는 임의 코드 실행 벡터가 될 수 있음.
- 제안: expression 평가 엔진이 샌드박스 환경에서 실행되는지 핸들러 레이어에서 검증 필요. 허용 함수 화이트리스트, 재귀 깊이 제한, 평가 타임아웃 적용.

---

**[WARNING] HTML 이메일 바디 — XSS / 이메일 헤더 인젝션**
- 위치: `send-email.schema.ts` — `body` (bodyType: 'html'), `to`/`cc`/`bcc`
- 상세: `bodyType: 'html'` 허용 시, 사용자 제어 데이터가 이메일 바디에 삽입되면 수신자 이메일 클라이언트에서 XSS가 발생할 수 있음. 또한 `to`/`cc`/`bcc`는 `z.array(z.string())`로만 선언되어 이메일 주소 형식 검증이 없음. `\r\n`이 포함된 문자열이 nodemailer에 그대로 전달될 경우 헤더 인젝션 가능성 존재.
- 제안: HTML 바디는 핸들러에서 DOMPurify 또는 동등한 라이브러리로 sanitize. 이메일 주소 필드는 `z.string().email()` 또는 정규식으로 검증. nodemailer 버전이 헤더 인젝션 방어를 포함하는지 확인 (v2.7.0+는 대체로 방어).

---

**[WARNING] 첨부파일 `content` 필드 — SSRF 가능성**
- 위치: `send-email.schema.ts` — `attachmentSchema.content` (label: 'Content / URL')
- 상세: 필드 레이블이 "Content / URL"로 URL 입력을 암시하며 스키마는 `z.string()` 무제한. 핸들러가 이 값을 URL로 인식해 서버 측에서 fetch하면 SSRF(Server-Side Request Forgery) 공격이 가능. 내부 메타데이터 서버(AWS 169.254.169.254 등) 또는 내부 서비스 접근이 우려됨.
- 제안: 핸들러에서 URL 스킴을 `https://`로 제한하고, 사설 IP 대역(RFC 1918, loopback, link-local) 차단. 또는 URL fetch 방식 대신 파일 레퍼런스(이미 업로드된 스토리지 키)만 허용.

---

**[WARNING] `caseDefSchema.id` — 입력 길이·형식 제한 없음**
- 위치: `switch.schema.ts` — `id: z.string().optional()`
- 상세: 새로 추가된 `id` 필드에 길이 제한, 허용 문자 제한이 없음. 이 값이 포트 ID로 그대로 사용되어 DB 컬럼·URL 경로·이벤트 라우팅 키로 전파될 경우, 비정상적으로 긴 문자열이나 특수문자(예: `../`, `<script>`, null byte)가 삽입될 수 있음.
- 제안: `z.string().max(64).regex(/^[a-zA-Z0-9_-]+$/).optional()` 수준의 슬러그 형식 강제. 이는 `spec §8`의 "stable id" 취지와도 일치.

---

**[INFO] `.passthrough()` 전역 사용 — 스키마 우회**
- 위치: 두 파일 모두 최상위 object와 중첩 object에 `.passthrough()` 적용
- 상세: `.passthrough()`는 선언되지 않은 키를 그대로 통과시켜 런타임까지 전달함. 악의적 사용자가 임의의 필드를 주입해도 스키마 레이어에서 걸러지지 않음. 특히 `sendEmailNodeConfigSchema`에서 nodemailer 옵션을 직접 주입하려는 시도를 차단하지 못할 수 있음.
- 제안: 외부 입력 경계(API 엔드포인트, LLM tool-call 파라미터)에서는 `.strict()` 또는 명시적 `.strip()`을 사용하고, `.passthrough()`는 내부 도메인 object에만 한정 적용.

---

**[INFO] 빈 문자열 기본값 — 논리적 유효성 미검증**
- 위치: `send-email.schema.ts` — `subject`, `body`
- 상세: `.default('')`로 변경 시 subject/body가 빈 채로도 유효한 config로 통과됨. 핸들러에서 발송 전 빈 subject 경고나 차단이 없으면 의도치 않은 빈 이메일이 발송될 수 있음(스팸 필터 점수 악화, 피싱 오용 가능).
- 제안: 이는 UX/비즈니스 규칙에 해당하나, 핸들러 레이어에서 `subject`가 빈 문자열일 때 경고 로그 또는 `WARNING` 포트 라우팅을 고려.

---

**[INFO] 계획 문서 내 내부 경로·라인 번호 노출**
- 위치: `plan/node-schema-audit.md` — F-1 항목의 `handler.ts:324,402`, 파일 경로 전체 노출
- 상세: 레포가 외부에 공개될 경우, 공격자에게 공격 표면 지도(취약 가능성이 있는 핸들러 위치, 현재 구조적 한계)를 제공함.
- 제안: `plan/`은 `.gitignore`에 추가하거나 private 레포에서만 관리. 또는 내부 이슈 트래커로 이관.

---

### 요약

이번 변경 자체(`.optional()` → `.default('')`, `id` 필드 추가)는 기능적으로 안전한 방향이나, 기저 스키마의 구조적 취약점이 드러났다. 가장 위험한 지점은 expression 위젯의 서버 측 평가 범위, HTML 이메일 바디의 XSS/헤더 인젝션, 그리고 첨부파일 URL fetch 시 SSRF 가능성으로, 세 가지 모두 스키마가 아닌 핸들러 레이어에서 방어해야 하는 항목이다. 신규 `id` 필드는 포트 라우팅 키로 사용되므로 슬러그 형식 제약이 없다면 특수문자 삽입 경로가 될 수 있다. `.passthrough()` 의 광범위한 사용은 스키마 검증 레이어를 사실상 무력화하므로, 외부 경계에서의 사용은 재검토가 필요하다.

### 위험도

**MEDIUM** (스키마 변경 자체는 낮은 위험, 단 기존 구조의 미완된 방어가 MEDIUM 수준의 리스크를 형성)