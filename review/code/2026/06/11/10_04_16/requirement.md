# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[INFO]** `[SPEC-DRIFT]` spec/5-system/7-llm-client.md §7.1 — LLM_STUB_MODE 프로덕션 차단 주체가 `main.ts` 로 기술됨
- **위치**: `spec/5-system/7-llm-client.md` §7.1 "프로덕션 차단" 항목
- **상세**: 해당 줄은 현재 `"main.ts 부팅 가드가 … throw 한다"` 고 기술하지만, 이번 PR 로 해당 가드는 `production-guards.ts` 의 `assertProductionConfig` 로 응집됐다. `main.ts` 는 이 함수를 위임 호출할 뿐이므로 spec 본문이 구현과 어긋난다. 코드 변경(main.ts 인라인 → production-guards.ts 응집)은 의도적이고 올바른 리팩터이므로 코드를 되돌리는 것이 오답이다. spec 을 갱신해야 한다.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/7-llm-client.md` §7.1 "프로덕션 차단" 줄을 `"assertProductionConfig (production-guards.ts) 가 … throw 한다"` 로 수정. 동일 내용은 `spec/data-flow/2-auth.md` §OAUTH_STUB_MODE 관련 기술에도 잠재적으로 동일 패턴이 있을 수 있어 병행 점검 권장.

---

### **[INFO]** `[SPEC-DRIFT]` spec/5-system/14-external-interaction-api.md §8.3 — `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 가드를 `main.ts` inline 가드의 "동형" 으로 참조
- **위치**: `spec/5-system/14-external-interaction-api.md` 651행
- **상세**: `INTERACTION_JWT_SECRET` fail-closed 설명에서 `"OAUTH_STUB_MODE`/`LLM_STUB_MODE` 부팅 가드와 동형"` 이라는 표현이 등장하는데, 그 가드가 이제 `production-guards.ts` 의 `assertProductionConfig` 임을 명시하지 않는다. 기존 기술이 오해를 유발할 수 있다.
- **제안**: 코드 유지 + spec 반영. 해당 줄에서 가드의 소재(`production-guards.ts`)를 명시하도록 spec 갱신. 본 reviewer 는 spec 직접 수정 금지.

---

### **[INFO]** `INTEGRATION_ENCRYPTION_KEY` production boot guard 부재 (범위 외 기존 GAP)
- **위치**: `.env.example` 158–160행, `credentials-transformer.ts`
- **상세**: `.env.example` 은 `INTEGRATION_ENCRYPTION_KEY` 가 `REQUIRED for production` 이며 미설정 시 credentials 가 plaintext 로 저장된다고 경고한다. 그러나 `assertProductionConfig` 에는 이 키에 대한 부팅 거부 로직이 없다. `credentials-transformer.ts` 는 미설정 시 `logger.warn` 만 한다(throw 없음). 본 PR 의 범위는 `ENCRYPTION_KEY`·`JWT_SECRET`·`MCP_ALLOW_INSECURE_URL` 세 항목으로 명확히 한정돼 있으므로 이는 기존 GAP 이며 이번 변경의 버그가 아니다. 단, `ENCRYPTION_KEY` 와 달리 `INTEGRATION_ENCRYPTION_KEY` 는 example placeholder(`change-me-to-a-32-byte-secret`)를 production 에서 그대로 쓰더라도 부팅이 거부되지 않는다.
- **제안**: 별도 follow-up 으로 `assertProductionConfig` 에 `INTEGRATION_ENCRYPTION_KEY` 가 example placeholder 인 경우 차단 로직 추가 고려. 본 PR 에서는 INFO 수준.

---

### **[INFO]** `MCP_ALLOW_INSECURE_URL` 트리거 케이스 — `'1'` 값 허용 여부
- **위치**: `production-guards.spec.ts` 469행 (`it.each(['true', '1'])`)
- **상세**: `isFlagOn` 함수는 `'true'` 와 `'1'` 을 모두 `true` 로 처리한다. 테스트도 두 값 모두 throw 를 확인한다. `.env.example` 의 `WEBAUTHN_ALLOW_FALLBACK` 은 `1` 로 사용하는 선례가 있어 `'1'` 지원은 의도적이다. 일관성 있음 — 발견사항 아님이나 참고로 명시.

---

## 요약

변경된 5개 파일(`.env.example`, `production-guards.ts`, `production-guards.spec.ts`, `main.ts`, `plan/complete/security-jwt-secret-fallback.md`) 과 2개 spec 파일(`spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`)은 의도한 기능—`NODE_ENV=production` 에서 `JWT_SECRET` 미설정/sentinel, `ENCRYPTION_KEY` 예시 키, `MCP_ALLOW_INSECURE_URL=true` 부팅 거부 및 `ALLOW_PRIVATE_HOST_TARGETS=true` warn-only—을 완전히 구현한다. 순수 함수 분리와 단위 테스트 전 분기 커버리지(`NODE_ENV≠production` no-op, 각 플래그별 throw, 유효값 통과)는 충분하다. `main.ts` 의 호출 위치도 `NestFactory.create` 이전으로 올바르다. spec 갱신은 `1-auth.md`·`11-mcp-client.md` 두 파일에 이미 반영됐으나, `7-llm-client.md §7.1` 과 `14-external-interaction-api.md §8.3` 의 가드 소재(`main.ts` 인라인 → `production-guards.ts`) 기술이 갱신되지 않았다 — 이는 `[SPEC-DRIFT]` 로, 코드는 옳고 spec 만 낡은 상태다. `INTEGRATION_ENCRYPTION_KEY` boot guard 부재는 이번 PR 범위 밖의 기존 GAP 이다. 전체 요구사항 충족 수준은 높고 모든 발견사항은 INFO 이다.

## 위험도

LOW
