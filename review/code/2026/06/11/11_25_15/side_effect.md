# 부작용(Side Effect) 리뷰 결과

리뷰 대상: production fail-closed 가드 응집 — spec 문서 변경 + consistency review 산출물
변경 파일: `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/secret-store.md`, `review/consistency/**` 산출물 14종

---

## 발견사항

### [INFO] 환경변수 읽기 의미 변경 — `NODE_ENV=production` 판정 범위 확장
- 위치: `spec/5-system/1-auth.md` §2.1, `spec/5-system/11-mcp-client.md` §3.2, `spec/conventions/secret-store.md` §3.3, §R5
- 상세: 이번 변경은 spec 문서 수준의 변경이므로 코드 레벨 환경변수 읽기·쓰기 자체가 발생하지 않는다. 그러나 spec 이 명문화한 내용에 따르면, `assertProductionConfig`(`common/config/production-guards.ts`)가 `NODE_ENV=production` 시 `JWT_SECRET`, `ENCRYPTION_KEY`, `MCP_ALLOW_INSECURE_URL` 세 환경변수를 **부팅 시 단일 지점에서 읽어 판정**한다. 이 판정 로직은 기존에 분산돼 있던 것을 응집한 것이므로, 동일 환경변수가 `main.ts` 이외의 경로에서도 별도로 읽히던 이전 흐름과 달라진다. 구체적으로 `LLM_STUB_MODE`/`OAUTH_STUB_MODE`의 production throw 위치가 spec 상 `main.ts` 직접 가드에서 `assertProductionConfig` 호출로 이동한 것을 문서가 반영한다. 실제 코드 변경이 아닌 spec 반영이므로 직접 부작용은 없으나, 구현 코드(`production-guards.spec.ts`, `main.ts`)가 이 spec 과 정합하지 않을 경우 silent 미스매치가 발생한다.
- 제안: 기존 `main.ts`의 분산 가드 코드가 실제로 `assertProductionConfig` 단일 호출로 교체됐는지 구현 코드(`codebase/backend/src/main.ts`)를 교차 확인할 것. spec만 변경되고 코드가 미반영이면 환경변수 판정 경로가 spec과 달라진다.

### [INFO] `INTERACTION_JWT_SECRET` 가드 분리 — 부팅 순서 의존성 암묵화
- 위치: `spec/5-system/14-external-interaction-api.md` §648 변경 줄, `spec/5-system/1-auth.md` §Rationale 신규 블록
- 상세: `assertProductionConfig`는 `main.ts` bootstrap 최초 단계에서 호출되지만, `INTERACTION_JWT_SECRET` 가드는 `InteractionTokenService` 생성자 throw로 NestJS DI 초기화 중에 발생한다. 두 가드의 발화 시점이 다르므로(전자: bootstrap 직전, 후자: DI 컨테이너 초기화 중) 부팅 실패 메시지·스택 트레이스·에러 핸들링 경로가 상이하다. spec이 이 차이를 "의도적 분리"로 명문화했으나, 두 경로 모두를 통합 테스트 없이 운영에서만 발견할 가능성이 있다. 이는 의도치 않은 동작 차이(부작용)는 아니지만, 가드 발화 순서·에러 형식의 불일치가 잠재적으로 운영 트러블슈팅을 복잡하게 만든다.
- 제안: `production-guards.spec.ts`가 두 경로(`assertProductionConfig` throw vs `InteractionTokenService` 생성자 throw)를 각각 별도 테스트 케이스로 커버하고 있는지 확인 권장.

### [INFO] `_retry_state.json` 내 절대 경로 하드코딩 — 이식성 부작용
- 위치: `review/consistency/2026/06/11/10_52_27/_retry_state.json` 전체
- 상세: `session_dir`, `prompt_file`, `output_file` 필드 전부가 `/Volumes/project/private/clemvion/...` 절대 경로를 담고 있다. 이 파일이 다른 머신 또는 경로에서 읽힐 경우 경로 미존재로 오케스트레이터가 오작동할 수 있다. 단, 이 파일은 단일 세션 재시도 상태 기록용으로 설계됐고, 세션 완료 후 참조되지 않는다면 실제 부작용이 발생하지 않는다.
- 제안: 오케스트레이터가 이 파일을 세션 종료 후 재활용하지 않는 구조인지 확인. 재활용 가능성이 있다면 상대 경로 또는 플레이스홀더 전략 검토.

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` warn 정책 — 기존 SSRF 가드 문서와 의미 변화
- 위치: `spec/5-system/11-mcp-client.md` §3.2 신규 blockquote
- 상세: 이 플래그가 production에서 "warn만 발생, 부팅 차단 없음"으로 spec에 새롭게 명문화됐다. 기존 `spec/4-nodes/4-integration/1-http-request.md` §4는 이 동작을 기술하지 않으므로, 두 파일이 동일 환경변수에 대해 서로 다른 설명 깊이를 제공한다. 소비자가 `http-request.md`만 참조해 이 플래그를 설정하면 production에서 warn이 발생하나 부팅은 된다는 사실을 인지 못할 수 있다. 의도하지 않은 부작용(보안 로그 무시·플래그 오남용)이 발생할 수 있다.
- 제안: `spec/4-nodes/4-integration/1-http-request.md` §4에 "production에서 `ALLOW_PRIVATE_HOST_TARGETS=true` 시 부팅은 하되 warn 로그 발생" 한 줄 추가 권장(다른 consistency checker도 동일 제안 포함).

---

## 요약

이번 변경은 전체가 **spec 문서와 review 산출물 파일의 추가·수정**이며, 실행 가능한 코드(`codebase/`) 변경이 포함되지 않는다. 따라서 전통적 의미의 전역 변수 오염, 파일시스템 부작용, 네트워크 호출, 이벤트/콜백 변경은 이 diff에서 직접 발생하지 않는다. 주요 부작용 관점 리스크는 세 가지다: (1) spec이 기술한 `assertProductionConfig` 단일 가드 블록 응집이 실제 코드와 정합하는지 미검증 시 환경변수 판정 경로 불일치, (2) `INTERACTION_JWT_SECRET` 가드가 DI 초기화 타이밍에 발화함으로써 `assertProductionConfig`와 부팅 실패 경로가 다른 점, (3) `ALLOW_PRIVATE_HOST_TARGETS` warn 정책이 1차 출처 spec에 미반영되어 소비자 오해 가능성. 모두 INFO 수준으로 spec-코드 정합성 검증 및 교차 문서 동기화로 해소 가능하며, 이번 diff 자체가 의도치 않은 상태 변경이나 API/인터페이스 파괴적 변경을 일으키지는 않는다.

## 위험도

LOW

STATUS: OK
