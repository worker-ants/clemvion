# 문서화(Documentation) Review

## 발견사항

### [INFO] e2e 테스트 인라인 주석 — 업데이트된 내용이 코드와 정합함
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` diff, 변경 구간 (L49~54)
- 상세: DB 직접 insert 우회 → `POST /api/llm-configs` 정식 API 경로로 교체하면서, 주석도 새 흐름(64-hex ENCRYPTION_KEY 적용, 암호화 경로 e2e 커버)에 맞게 정확히 갱신됐다. 오래된 주석 문제 없음.
- 제안: 없음 (양호).

### [INFO] `docker-compose.e2e.yml` — ENCRYPTION_KEY 변경에 대한 인라인 설명 충분
- 위치: `docker-compose.e2e.yml` diff, 변경 구간 (L134~141)
- 상세: 64-hex(32B) 필요 이유(AES-256-GCM, `Buffer.from(key,'hex')`, 기존 32-char=16B 문제)와 `INTEGRATION_ENCRYPTION_KEY` 는 SHA-256 derive 라 길이 무관하다는 사항이 모두 주석에 기술됨. e2e 전용 값임도 "운영 절대 사용 금지" 구문으로 명시됨.
- 제안: 없음 (양호).

### [INFO] `spec/5-system/7-llm-client.md` — `LLM_STUB_MODE` 환경변수 신규 문서화 완료
- 위치: `spec/5-system/7-llm-client.md` diff, §7.1 신설 구간
- 상세: `LLM_STUB_MODE` 의 동작(캐시/decrypt 앞 우선), 프로덕션 fail-closed 동작(`main.ts` 부팅 가드), e2e 목적 모두 기술됨. `OAUTH_STUB_MODE` 선례 언급도 맥락을 잡아 줌.
- 제안: 없음 (양호). 단, 독자가 `OAUTH_STUB_MODE` 의 경로(`spec/` 어디?)를 찾을 수 없으므로 간략한 cross-reference(예: `spec/5-system/X-auth.md`)를 추가하면 더 나아지나 선택사항이다.

### [WARNING] `spec/5-system/7-llm-client.md` §7.1 — `StubLlmClient` 의 동작(echo 포맷)이 문서화되지 않음
- 위치: `spec/5-system/7-llm-client.md` §7.1
- 상세: e2e 테스트 코드에서 `StubLlmClient` 가 `[stub] received: <msg>` 포맷으로 echo 응답하고, tool call 을 생성하지 않아 핸들러가 다시 park 한다는 결정적 동작이 e2e 파일 주석에만 기술돼 있다(spec 파일 diff 미포함). spec §7.1 에는 stub 의 구체적 응답 동작이 없어, 나중에 `StubLlmClient` 를 수정하는 개발자가 spec 만 읽어서는 e2e 인변식 을 파악할 수 없다.
- 제안: §7.1 에 stub 응답 계약 1~2줄 추가. 예: "`StubLlmClient` 는 마지막 user 메시지를 `[stub] received: <msg>` 로 echo 하고, tool call 을 생성하지 않는다(핸들러 재-park 보장)."

### [INFO] `spec/5-system/14-external-interaction-api.md` §8.3 — `iext_*` / `itk_*` secret 출처 명확화 완료
- 위치: `spec/5-system/14-external-interaction-api.md` diff, §8.3 및 §10.1
- 상세: 이전 "trigger 별 분리" 단일 설명을 family 별(`itk_*` vs `iext_*`)로 분리하고 `INTERACTION_JWT_SECRET` fallback 체인까지 정확히 기술됨. §10.1 의 Swagger scheme 등록 설명도 동기화됨.
- 제안: 없음 (양호).

### [INFO] `spec/data-flow/3-execution.md` — `resume_call_stack`(V087) doc-sync 완료
- 위치: `spec/data-flow/3-execution.md` diff, L51(park) · L112(rehydration) 구간
- 상세: park 시 `conversation_thread / user_variables` 목록에 `resume_call_stack` 이 추가됐고, rehydration 에서 `driveCallStackResume` frame-by-frame 재진입도 기술됨. 변경 내용과 코드 경로가 정합함.
- 제안: 없음 (양호).

### [INFO] `plan/in-progress/exec-park-b2a-followup.md` — 항목별 담당 역할·범위 경계 명시
- 위치: `plan/in-progress/exec-park-b2a-followup.md` 전체
- 상세: ①②③ → project-planner, ④ → developer 명확 구분. 범위 경계(§8.3 한정, 미수정 항목 열거)도 기술됨. plan 문서 자체 목적에 부합.
- 제안: 없음 (양호).

### [WARNING] `spec/5-system/7-llm-client.md` §7.1 — `StubLlmClient` 코드 위치(파일 경로) 미언급
- 위치: `spec/5-system/7-llm-client.md` §7.1
- 상세: spec 의 `code:` frontmatter 에 `codebase/backend/src/modules/llm/clients/*.ts` 가 포함돼 있어 stub 파일도 그 글로브 아래 있을 것이나, 명시적 파일명이 없다. `OAUTH_STUB_MODE` 선례처럼 구현 파일을 bracket link 로 참조하면 문서·코드 추적이 용이해진다.
- 제안: §7.1 에 구현 파일 링크 추가. 예: `([`StubLlmClient`](../../codebase/backend/src/modules/llm/clients/stub.client.ts))` (실제 파일명 확인 후).

### [INFO] `docker-compose.e2e.yml` — `JWT_SECRET` 인라인 주석은 runner env fallback 로직을 test 파일에서만 설명
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L493~497
- 상세: e2e 파일에서 `JWT_SECRET` fallback 값(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)이 `docker-compose.e2e.yml` 의 값과 동일해야 한다는 결합이 주석으로만 표현됨. 이 사항은 현재 변경 범위 밖이지만, 테스트 파일 주석이 이미 충분히 설명하고 있어 별도 문서화는 불필요.
- 제안: 없음 (현 수준 양호).

## 요약

이번 변경(PR-B2a follow-up)의 문서화 품질은 전반적으로 우수하다. `docker-compose.e2e.yml` 의 ENCRYPTION_KEY 64-hex 교정 이유, `LLM_STUB_MODE` 신규 spec 섹션, EIA §8.3 토큰 family 분리 명확화, `data-flow/3-execution.md` 의 `resume_call_stack` doc-sync 모두 변경된 코드와 정합하며 충분한 인라인 설명을 갖추고 있다. 주요 미흡 사항은 두 가지다: (1) `spec/5-system/7-llm-client.md` §7.1 에 `StubLlmClient` 의 결정적 echo 응답 계약(`[stub] received: <msg>`, no-tool-call 보장)이 빠져 있어 해당 구현체를 수정하는 개발자가 e2e 불변식을 spec 에서 파악할 수 없고, (2) stub 구현 파일 경로 링크가 누락돼 있다. 두 항목 모두 WARNING 수준이며 기능 동작에는 영향이 없으나, spec-as-SoT 원칙 상 보완이 권장된다.

## 위험도

LOW
