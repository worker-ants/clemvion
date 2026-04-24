# Review Resolution — 2026-04-24_20-13-26

리뷰 대상: 커밋 `e4e1fa5` (노드 스키마 audit A 범위 — `switch.caseDefSchema.id` 추가 + `send-email` `subject`/`body` `.default('')`).
Critical 0 + Warning 10 + Info 10. 이번 턴에 **스키마·리소스 범위 Warning 6건 전건 + 선택 Info 5건** 조치. 보안 Warning 4건 (W-1~W-4) 은 핸들러·경계 레이어 영역으로 본 커밋 스코프를 벗어나 **Defer** 로 기록. 후속 트리거 조건은 아래 참고.

## Warning — 스키마·리소스 영역 (조치 완료)

| ID | 조치 |
|----|------|
| **W-5** | `backend/src/nodes/logic/switch/switch.schema.ts` `caseDefSchema.id` 에 `.regex(/^[a-zA-Z0-9_-]+$/)` + `.max(64)` 추가. 포트 라우팅 키로 전파되는 id 가 공백·특수문자·엔티티를 포함하지 못하도록 스키마 단계에서 차단. |
| **W-6** | `backend/src/nodes/integration/send-email/send-email.schema.spec.ts` 신규. (1) `subject`/`body` omit 시 `''` 기본값, (2) 명시적 `''` 유효, (3) `to/cc/bcc/attachments` omit 시 `[]`, (4) `bodyType` omit 시 `'text'`, (5) `'markdown'` 거부, (6) 성공/실패 양쪽 output shape 수용 — 모두 녹색. |
| **W-7** | `backend/src/nodes/logic/switch/switch.schema.spec.ts` 신규. `caseDefSchema.id` optional 허용 + slug 규칙 + 길이 상한 + 계층 불일치 (스키마 optional ↔ resolver fallback ↔ handler runtime-required) 고정. |
| **W-8** | `grep -rn "as SendEmailConfig\|as SwitchConfig" backend/src` 실행. 결과 `backend/src/nodes/logic/switch/switch.handler.ts:35,101` 두 군데 `as unknown as SwitchConfig`. 캐스팅 대상은 handler-local 인터페이스 (zod-inferred `SwitchConfig` 가 아닌, handler 내부 struct). `validate()` 가 모든 필드를 manual 체크한 뒤 `execute()` 가 실행되므로 런타임 안전. `send-email.handler.ts` 는 raw 캐스팅 없이 field-by-field `as string` 경로만 사용 — clean. 코드 변경 없음. |
| **W-9** | `backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.ts` `switchPorts` 의 fallback 조건을 `c.id.length > 0` → `c.id.trim().length > 0` 으로 변경. 공백만 담긴 id (`' '`, `'\t'`) 가 truthy 로 통과해 공백 포트 id 가 생성되는 엣지 케이스 차단. frontend mirror (`frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`) 도 동일하게 갱신 — 파일 상단 "two copies must stay in lockstep" 주석 규약 유지. backend `resolve-dynamic-ports.spec.ts` + frontend `__tests__/resolve-dynamic-ports.test.ts` 양쪽에 "whitespace-only id → fallback" 회귀 케이스 추가. |
| **W-10** | 직전 커밋에서 `switch.schema.ts` `caseDefSchema.id` 위 7줄 블록 주석을 3줄로 압축 (한 줄 요약 + 형식 제약 근거). "one short line max" 코딩 표준 회복. |

## Warning — 보안 영역 (Defer)

| ID | 이슈 | Defer 근거 / 트리거 |
|----|------|---------------------|
| **W-1** | `switchValue` / `subject` / `body` 의 `widget: 'expression'` 은 LLM 이 인자로 싣는 템플릿 문자열을 서버 측에서 평가할 때 SSTI / 코드 인젝션 벡터가 될 수 있음. | **Defer** — 스키마 레이어가 아닌 `expression-engine` 평가 단계의 샌드박스·화이트리스트·타임아웃 설계 영역. 현재 expression 평가 경로 전체 재감사가 필요하며, 단발 스키마 변경으로 해결 불가. **트리거**: expression 평가 결과로 외부 IO / `eval` / `Function` 호출 경로가 발견되거나, 보안 스캐너가 이를 탐지할 때. 별도 보안 티켓으로 분리. |
| **W-2** | `bodyType: 'html'` 허용으로 수신자 클라이언트 XSS, `to`/`cc`/`bcc` 에 `\r\n` 포함 시 SMTP 헤더 인젝션 가능. | **Defer** — `send-email.handler.ts` 가 DOMPurify 로 HTML sanitize, `z.string().email()` 로 주소 검증, CRLF strip 을 해야 하는 영역. 핸들러 전면 수정. **트리거**: 내/외부 pen-test 또는 실제 헤더 인젝션 시도 로그가 관측될 때. 스키마 단에서 `z.string().email()` 만 먼저 도입할지는 migration 영향 (기존 데이터에 템플릿 문자열 포함 여부) 검토 후 결정. |
| **W-3** | `attachmentSchema.content` 가 "Content / URL" 라벨이며 무제한 `z.string()`. 핸들러가 URL fetch 시 사설 IP / 파일 스킴 접근 가능 (SSRF). | **Defer** — 첨부 URL fetch 가 실제로 구현돼 있는지 + 어떤 HTTP 클라이언트로 이뤄지는지 확인 후 `https://` 스킴 고정 + 사설 IP 차단 미들웨어 필요. **트리거**: attachment URL fetch 경로 구현이 완료되거나, 스키마에서 `content` 가 URL 전용으로 재정의될 때. |
| **W-4** | `.passthrough()` 광범위 사용으로 외부 경계에서 임의 필드 주입 차단 불가. | **Defer** — 현 스키마 레이어는 모든 노드에 `passthrough()` 를 일관 적용해 UI 확장 / 역호환성을 확보 중이라 단발 수정으로 해결 불가. API 입력 경계 (shadow-workflow 의 `add_node` / `update_node` args) 에서 `strip()` 적용 전략은 별도 설계 필요. **트리거**: `.passthrough()` 로 인한 데이터 오염 사례가 감지되거나, 보안 감사가 공식 요구될 때. |

## Info — 선택 반영

| ID | 조치 |
|----|------|
| **I-4** | `send-email.schema.ts` 의 `subject`/`body` `.default('')` 위에 한 줄 주석 추가 — "LLM 이 optional 로 오인해 인자 생략하는 것을 차단 (review I-4)". 의도 명시. |
| **I-5** | `plan/node-schema-audit.md` F-1 의 `handler.ts:324,402` 하드코딩 라인 번호를 심볼 기반 참조로 교체 ("핸들러 내부의 `class_${portIndex}` 하드코딩 부분 (현재 `categories.map` 및 port 라우팅 결정 지점)"). 라인 이동에 취약한 참조 제거. |
| **I-6** | `plan/node-schema-audit.md` F-2 말미에 "**결정 보류 — 2026-04-24 audit 시점**" 한 줄 추가. (a) 안 우세이나 spec §8 개정 필요, 트리거 명시. |
| **I-8** | F-1 본문의 resolver 패턴 제안을 본 턴에 switch 에 적용한 `c.id?.trim() || 'case_${i}'` 스타일로 통일 (`c.id?.trim() || 'class_${i}'`). 공백 truthy 엣지 포함. |
| **I-9** | F-5 (text-classifier category `name`/`description` default) 를 F-1 본문 스코프에 병합. 독립 섹션 제거 + 우선순위 섹션에도 반영. |
| **I-10** | F-4 본문 끝에 "다음 schema 배치 커밋에 1줄 수정 포함" 메모 보강. |

### 반영하지 않음

- **I-1** (F-1 text-classifier stable id 배치 처리): follow-up 유지. 본 커밋 스코프 밖.
- **I-2** (output vs config schema `subject` 비대칭): 의도적 설계 — output 은 성공/실패 분기 표현으로 `.optional()`, config 는 LLM omit 방지로 `.default('')`. I-4 의 한 줄 주석이 config 측 의도를 충분히 설명하므로 output 측에는 별도 주석 추가하지 않음 (과도한 주석 회피, CLAUDE.md "no unnecessary comments" 원칙).
- **I-3** (config 직렬화 shape 변경): 기존 API consumer 가 이미 `subject`/`body` 를 optional 로 취급 중 (프런트 editor store, workflow save payload). shape 차이는 `''` vs `undefined` 이며 기능적 동치. 변경 없음.
- **I-7** (null DB 레코드 ZodError 가능성): 현 audit 시점에는 `workflow_nodes.config` 내 `subject` / `body` 를 `null` 로 저장하는 경로가 없음 (frontend default, handler default, shadow default 모두 빈 문자열 보장). 실제 null 레코드가 발견되면 `.nullable().default('')` 로 전환. 현재는 noop.

## 재검증 결과

1. `grep -rn "as SendEmailConfig\|as SwitchConfig" backend/src`
   → `backend/src/nodes/logic/switch/switch.handler.ts:35,101` 두 줄. handler-local `SwitchConfig` interface (not zod-inferred) + manual `validate()` 보증으로 안전. RESOLUTION 에 기록함.
2. `cd backend && npm run lint && npm test && npm run build` — clean.
3. `cd frontend && npm run lint && npm test && npm run build` — clean (frontend 는 `resolve-dynamic-ports.ts` mirror + 테스트 추가만 포함).

## Follow-up (이번 범위 밖)

- **Security audit**: W-1 ~ W-4 보안 티켓. expression 평가 샌드박스, HTML/이메일 sanitize, SSRF 방어, `.passthrough()` 감사. 스키마 외 영역이므로 별도 PR.
- **F-1 batch**: `plan/node-schema-audit.md` F-1 (text-classifier stable id + name/description default 병합). 사용자 보고 발생 시 즉시 처리.
- **F-2 (carousel/chart/table/template 버튼 id 정책)**: 2026-04-24 audit 시점 결정 보류. 트리거 발생 시 spec 개정 후 (a) 안 진행.
- **F-3 (form.optionSchema.value default), F-4 (http-request keyValueSchema passthrough)**: 다음 schema 배치 커밋에 1줄씩 포함.
