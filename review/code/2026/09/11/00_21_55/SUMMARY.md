# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없다(직전 2라운드가 낸 CRITICAL 2건은 소스 직접 대조로 닫혀 있음을 14개 reviewer 전원이 재확인). 다만 WARNING 3건 중 2건(테스트 커버리지 공백 · slack/discord 유저가이드 미갱신)은 이번 라운드에 새로 식별된 미등재 항목이라 조치가 필요하다. **강제(router_safety) 화이트리스트 7명 전원 결과 확보 완료** — 화이트리스트 미이행 없음.

## Critical 발견사항

없음. (이전 라운드 CRITICAL 2건 — R-CC-10 single-path 우회, `inboundSigningRef` PATCH 소실로 인한 인입 웹훅 서명 fail-open — 은 이번 라운드에서 security/architecture/requirement/concurrency/database 등 다수 reviewer 가 소스를 직접 읽어 독립적으로 닫혀 있음을 재확인했다.)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 동기화 (user_guide_sync) | PATCH 가 이제 `inboundSigningPlaintext`(slack Signing Secret / discord Public Key)를 전면 거부하는 신규 동작을, telegram·triggers 문서(ko/en)는 이번 diff 로 갱신했지만 **slack/discord 대응 문서(ko/en 4파일)는 여전히 미착수**다. 직전 라운드가 이미 "부수 발견"으로 지적했는데도 트래커에 등재되지 않고 조용히 빠졌다. | `codebase/frontend/src/content/docs/06-integrations-and-config/{slack,discord}.mdx`, `{slack,discord}.en.mdx` | telegram 의 "Rotating the bot token(single-path)" 절과 대응하는 "Signing Secret/Public Key 는 PATCH 로 변경 불가" 절을 트러블슈팅 절 직전에 신설하고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 명시 등재 |
| 2 | 요구사항/테스트 (requirement) | 이 PR 이 신설한 `assertChatChannelAlreadySetUp` 의 "최초 설정은 PATCH 로 불가" 분기(조용한 degraded 상태를 막는 마지막 방어선)가 unit·service·e2e 어느 계층에도 회귀 테스트가 없다 | `codebase/backend/src/modules/triggers/triggers.service.ts:722-747`(특히 728-735행) | `triggers.service.spec.ts` R-CC-21 PATCH suite 에 `chatChannel` 없는 트리거로 PATCH 시 400(`details.field='chatChannel'`)을 단언하는 케이스 1개 추가 |
| 3 | 동시성/DB (concurrency, database, security 중복 확인) | 같은 트리거에 대한 동시 PATCH 가 `Trigger.config`(JSONB) 를 lost update 로 잃을 수 있어, 이 PR 이 단일 요청 기준으로 막 닫은 "PATCH 후 `inboundSigningRef` 소실 → 인입 서명 fail-open" 이 동시성 경로로 재발할 이론적 여지가 있음 | `codebase/backend/src/modules/triggers/triggers.service.ts` `update()`/`setupChatChannel()`(낙관적 잠금·트랜잭션 없음), 자매 메서드 `rotateChatChannelBotToken()` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2116-2126행)에 등재·defer 확정된 사전 존재 설계(CCH-SE-01) — 이번 PR 을 막을 사유 아님. 실제 동시 PATCH 트래픽 관측 시 advisory lock/`SELECT ... FOR UPDATE` 우선순위 상향 권고 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 생성(POST) 경로 `ChatChannelConfigDto.botToken` 에 `@MinLength` validator 가 없어 빈 문자열 토큰이 저장될 수 있음(권한 우회 아님) | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:174-187` | 이미 트래커 등재 — 후속에서 `@MinLength(1)`/provider 별 정규식 추가 검토 |
| 2 | 아키텍처/유지보수 | `ChatChannelInput`/`ChatChannelInputMode` 유니온 타입이 DTO 모듈이 아니라 서비스 파일에 선언됨(carry-forward, 미해소) | `triggers.service.ts:60,73` | 재사용처가 생기면 `dto/chat-channel-config.dto.ts` 로 이동 검토 |
| 3 | 아키텍처 | `trigger.config.chatChannel` 을 가리키는 인라인 구조적 캐스팅이 3곳(526-528·726-727·1267-1269행) 산재 — 이번 PR 이 CRITICAL 수정을 위해 1곳 추가 | `triggers.service.ts` | 단일 접근자(`readTriggerChatChannelConfig`)로 통합 검토 |
| 4 | 아키텍처/유지보수 | `update()`(123줄)·`setupChatChannel()`(186줄)이 각각 다관심사를 한 메서드에 담은 채 계속 비대화(두 라운드 전부터 추적 중, 이번 라운드는 소폭 증가만) | `triggers.service.ts:485-607`, `:1075-1260` | `resolveChatChannelSecretWrites(...)` 등 헬퍼 분리(트래커 등재, 이번 PR 범위 아님) |
| 5 | 유지보수 | `VALIDATION_ERROR` "필드 존재 시 거부" 패턴이 3개 private 메서드에 걸쳐 7회 거의 동일하게 반복 | `triggers.service.ts:650-672,697-712,728-746` | `rejectIfDefined(field, message)` 류 헬퍼로 단순 존재검사형(5블록) 추출 검토, 급하지 않음 |
| 6 | 유지보수 | 컨트롤러 `@ApiBadRequestResponse` description 구두점 불일치(문장 연결이 계속 길어짐), `it.each` 타이틀의 `%s` 개수(3)와 배열 원소(4) 불일치로 실패 로그 가독성 저하 | `triggers.controller.ts:120-131`, `triggers.service.spec.ts:3236-3263` | 동작 영향 없음 — 다음 편집 시 정리 |
| 7 | 테스트 | `inboundSigningRef` 보존이 unit 레벨에서만 검증되고 실제 웹훅 서명 검증까지 잇는 e2e 없음; `assertChatChannelAlreadySetUp` 의 `incoming.provider` falsy 분기 미검증; 두 spec 파일의 `cardBody` fixture 리터럴 중복(회귀 캐너리 drift 위험) | `triggers.service.spec.ts:3179-3194,3000`, `trigger-dto-validation.spec.ts:785`, `triggers.service.ts:740` | 모두 비차단 — 여력 있을 때 e2e 케이스·공유 fixture 헬퍼 추가 |
| 8 | API 계약 | `ChatChannelUpdateConfigDto` 의 금지 필드 2개가 여전히 `writeOnly: true` 로 선언돼 OpenAPI 코드젠 신호가 "PATCH 로 보낼 수 있는 값"처럼 보임; PATCH 의 의도된 breaking change 3축에 대한 CHANGELOG 미기재 | `chat-channel-config.dto.ts:381,396` | 이미 검토·유지 결정된 사안(SDK 코드젠 지원 시 재검토) |
| 9 | 문서 | `triggers.mdx:429` 신규 안내 문장에 이중 공백 오타(scope·documentation·user_guide_sync 3개 reviewer 독립 발견); 사용자 문서가 `details.field` 두 갈래 중 일반적인 한쪽(비어있지 않은 값)만 서술 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429` | 공백 한 칸 제거; 두 갈래 서술은 후속 문서 정리 시 보완(우선순위 낮음) |
| 10 | 의존성 | `package.json`/lock 파일 변경 0건, 신규 심볼은 전부 기존 고정 버전 패키지(`@nestjs/swagger` 등)의 export 이거나 브랜치 분기 이전부터 있던 workspace 내부 패키지 | 해당 없음 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CRITICAL 2건(R-CC-10, inboundSigningRef fail-open) 닫힘 재확인. 신규 결함 없음, 기존 등재 항목(botToken MinLength 부재, lost update)만 재확인 |
| performance | NONE | 발견사항 없음 — N+1·추가 I/O·복잡도 증가 없음, secret-store 호출 오히려 감소 |
| architecture | LOW | 이전 WARNING(`mode` 판별자 타입 미결속) 오버로드로 해소 확인. 남은 건 전부 INFO(유니온 타입 위치, 캐스팅 산재, 비대화, 규칙 4계층 분산) |
| requirement | LOW | spec §5.4.1/R-CC-21 과 line-level 일치 확인. WARNING 1건(최초 설정 거부 분기 테스트 커버리지 0) |
| scope | NONE | 3라운드 델타가 직전 WARNING 5건에 1:1 대응하는 최소 수정임을 확인. INFO 1건(mdx 이중 공백) |
| side_effect | LOW | PATCH 계약의 의도된 breaking change 3축 재확인(문서화·테스트로 고정됨). 신규 부작용 없음 |
| maintainability | LOW | 이전 WARNING 3건(import 분절, mode 타입 미결속, null 비대칭) 전부 해소 확인. 남은 건 INFO(함수 비대화, 메시지 반복 등) |
| testing | LOW | 181/182 GREEN 재실행 확인. 이전 WARNING(null/'' 비대칭) 해소 확인, 남은 INFO 3건 carry-over |
| documentation | NONE | JSDoc·Swagger·mdx 문서 동반 갱신 완성도 높음. INFO 2건(오타, 문서 스코프 축소) |
| dependency | NONE | 신규 패키지·lock 변경 0건 |
| database | NONE | 스키마/마이그레이션 변경 없음. INFO 2건(비원자적 2단계 커밋, lost update — 기존 등재) |
| concurrency | LOW | WARNING 1건(동시 PATCH lost update, 사전 존재·이미 defer 확정, 이번 라운드도 미해소 재확인) |
| api_contract | LOW | 이전 WARNING 4건(Swagger 미반영·타입 미결속·측정범위·문서오기) 전부 코드로 반영 확인. INFO 2건 유지 |
| user_guide_sync | WARNING | slack/discord 유저가이드 미갱신(신규 WARNING, 트래커 미등재) + INFO 1건(오타) |

## 발견 없는 에이전트

- performance — 알고리즘 복잡도·DB/외부 API 호출·메모리·캐싱 어느 축으로도 새로운 부담 없음(발견사항 명시적으로 "없음")

## 권장 조치사항

1. slack.mdx/discord.mdx(ko/en 4파일)에 `inboundSigningPlaintext` PATCH 전면 차단 안내 절을 telegram 문서에 대응하도록 신설하고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 명시 등재한다(직전 라운드부터 두 번째로 조용히 누락된 이력이 있으므로 이번엔 트래커 등재까지 확인).
2. `assertChatChannelAlreadySetUp` 의 "최초 설정은 PATCH 불가" 분기에 회귀 테스트 1건을 추가한다(`triggers.service.spec.ts` R-CC-21 PATCH suite).
3. (경미) `triggers.mdx:429` 이중 공백 오타를 제거한다.
4. 동시 PATCH lost update / `botToken` `@MinLength(1)` 부재는 이미 중앙 트래커에 등재·defer 확정된 사안이므로 이번 PR 을 막을 사유는 아니나, 실제 동시 PATCH 트래픽이 관측되면 advisory lock 도입 우선순위를 재검토한다.
5. (여력 있을 때) `inboundSigningRef` 보존을 실제 웹훅 서명 검증까지 잇는 e2e 1건, `cardBody` fixture 공유 헬퍼화, `VALIDATION_ERROR` 거부 블록 헬퍼 추출을 후속으로 고려한다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재, prompt 에 `routing_skip_reason` 없음). 전체 reviewer(14명) 실행.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 완료, 화이트리스트 미이행 없음.
- 제외된 reviewer: 없음(라우터 미사용이므로 전원 실행).
