# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(누락 없음, `plan_coherence.md` 는 디스크 미기록 상태였으나 인라인 전문을 확보해 `plan_coherence.md` 로 영속화 완료). CRITICAL 발견 0건.

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 다만 "api-convention.md 미등재" 결정의 핵심 근거("OpenAPI 광고 가드 선례 없음")가 2개 checker(rationale_continuity·plan_coherence)에 의해 그 문서 자신의 frontmatter 로 직접 반증되어, 결론은 아니어도 근거의 정확성이 흔들린다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없어 인계 대상 없음. 참고로 target 은 `project-planner` 소유의 spec draft(`--spec` 모드)이므로, 아래 WARNING 은 애초에 권한 밖 문제가 아니라 같은 세션에서 바로 정정 가능한 문면 오류다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, plan_coherence (cross_spec 은 관련 INFO로 교차 확인) | `api-convention.md` `code:` 미등재 근거("OpenAPI 광고 가드를 담은 선례가 없다")가 사실과 어긋남 — `spec/5-system/2-api-convention.md` frontmatter `code:` 에 이미 `swagger-dto-contract*`·`response-contract*`·`swagger-probe*`·`user-entity-exposure*` 가 등재돼 있고, 특히 `response-contract.ts` 는 "광고 DTO 스키마 ↔ 실제 응답" 을 대조하는 정확히 같은 부류의 가드(§5.4 가 이중 등재 관행까지 명문화). `dto-class-name-collision`·`param-uuid-pipe` 만 인용해 "선례 없음"이라 단정한 것은 인용 목록 안에서 스스로 반증됨 | `plan/in-progress/spec-draft-swagger-http-status-guard.md` "왜 이 문서인가" 문단, "기각한 대안 — api-convention 에도 적고 등재한다" 불릿 | `spec/5-system/2-api-convention.md` frontmatter `code:`(기존 등재 사실) | "선례가 없다" 문장 삭제. 대신 "그 가드들은 §5.4/§5-1 처럼 두 문서 각각이 이미 명문화한 서로 다른 규칙을 한 코드가 겸해 시행하기 때문이고, `http-status-advertised` 가 시행하는 규칙은 `api-convention.md` 어디에도 명문화돼 있지 않다(§6은 의미만 정의)"는 논거로 교체(결론은 유지 가능). 아울러 `api-convention.md` §6 표에 "실제 코드와의 일치는 [Swagger 규약 §2-4] 참조" 역참조 한 줄 추가 고려(cross_spec INFO) |
| 2 | rationale_continuity | 신설 Rationale 문단이 `oauthBegin` 의 자원 생성 사실을, 직전 `--impl-prep` 라운드에서 이미 지적·정정(`post-status-openapi.md` W2)된 "14곳 전부 자원 미생성" 전칭으로 되돌려 재서술 — 영구 Rationale 에 정정된 오류가 재도입됨 | `plan/in-progress/spec-draft-swagger-http-status-guard.md` L74-76 (변경(4) 신규 Rationale, swagger.md `## Rationale` 끝에 영구 삽입 예정) | `plan/in-progress/post-status-openapi.md` L44-49/L68 (W2 처분 — `oauthBegin` 은 Cafe24 Private/MakeShop 분기에서 `pending_install` 행 생성, 생성은 부수효과) | 해당 불릿을 "이번에 고친 14곳 대부분은 자원을 만들지 않는 액션이다(`oauthBegin` 은 Cafe24 Private/MakeShop 분기에서 `pending_install` 행을 만들지만, 이는 설치 흐름의 부수효과이고 §2-5 래퍼 표가 그 분기 응답을 200으로 이미 적고 있다)."로 narrowing |
| 3 | convention_compliance | §5-4 체크리스트 예시 데코레이터 목록(`ApiOk*`·`ApiCreated*`·`ApiNoContent*`)이 같은 작업의 구현 plan 이 확정한 5갈래 인벤토리 중 `ApiAccepted*`(202, §5-2 표에 기존 등재된 정식 헬퍼)와 generic `ApiResponse({status:2xx})` 를 누락 — draft 자신이 세운 "이름→코드 표를 손으로 쓰지 않는다" 원칙과 문면상 어긋남 | `plan/in-progress/spec-draft-swagger-http-status-guard.md` "변경 (3) — §5-4 체크리스트" | `plan/in-progress/post-status-openapi.md` 실측 절(5갈래 인벤토리) / `spec/conventions/swagger.md` §5-2 (`ApiAcceptedWrappedResponse` 기존 등재) | 체크리스트 예시에 `ApiAccepted* 202` 추가(자매 plan 과 동일 인벤토리로 정합) 또는 특정 이름 나열을 없애고 "§2-4 표의 모든 2xx 데코레이터"로 표 전체를 가리키도록 변경 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `api-convention.md` §6 HTTP 상태 코드 표가 신설된 "광고=실제" 불변식으로의 역참조 링크를 아직 갖지 않음(§5.2/§5.4 의 기존 상호참조 관례와 비교해 비대칭) | `spec/5-system/2-api-convention.md` §6 표 | §6 표 상단 또는 200/201/204 행에 "실제 코드와의 일치는 [Swagger 규약 §2-4] 참조" 한 줄 추가(필수 아님) |
| 2 | convention_compliance | 신설 가드명 `http-status-advertised` 가 과거분사 어미로, 기존 가드(`swagger-dto-contract`·`dto-class-name-collision`·`user-entity-exposure`·`param-uuid-pipe`, 전부 명사형 어미)와 품사가 다름 | frontmatter `code:` 삽입부, §2-4 본문 | 조치 불요(관련 규약 부재) — 추후 가드 명명 규칙 성문화 시 참고 표본으로 남길 것 |
| 3 | plan_coherence | repo-guard `code:` 등재 "관례화" 여부(`spec-draft-nullable-notation-followups.md:4006` 미결 질문 (b))를 target 이 건드리지 않음 — 개별 등재 현 상태와 형태 일치, 충돌 아님 | `plan/in-progress/spec-draft-swagger-http-status-guard.md` "변경 (1)" | 조치 불요 — `post-status-openapi.md` 체크리스트(트래커 INFO4 갱신)가 이미 소유 |
| 4 | plan_coherence | "정하지 않는 것"으로 명시 배제한 두 미결 항목(자원 미생성 POST 액션 코드 명문화, `workspaces.controller.ts` 204 전환)이 각 plan 에서 실제로 미결 상태와 정확히 일치 — 선점 없음 | `plan/in-progress/spec-draft-swagger-http-status-guard.md` "정하지 않는 것" 문단 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | api-convention/spec-impl-evidence/관련 spec 문서와 모순 없음. §6 표 역참조 누락은 INFO |
| rationale_continuity | MEDIUM | "선례 없음" 근거가 자기 frontmatter 로 반증됨(WARNING) + oauthBegin 전칭 재도입(WARNING) |
| convention_compliance | LOW | §5-4 체크리스트 예시 인벤토리 협소(WARNING) + 가드명 어미 관찰(INFO). 구조·앵커·명명 관례는 전부 정합 |
| plan_coherence | LOW | 동일 "선례 없음" 근거 결함 재확인(WARNING) + 두 미결 항목 defer 정합(INFO×2). 병행 plan 편집 충돌 없음 |
| naming_collision | NONE | 신규 식별자(`http-status-advertised` 등) 전수 grep 0건 재확인, 충돌 없음 |

## 권장 조치사항
1. (WARNING #1, 최우선) `plan/in-progress/spec-draft-swagger-http-status-guard.md` 의 "선례가 없다" 문장을 삭제하고, `response-contract*` 등 기존 이중 등재 선례를 인정한 뒤 "두 문서 각각이 이미 명문화한 서로 다른 규칙을 겸해 시행하는 가드만 이중 등재한다"는 정확한 논거로 교체.
2. (WARNING #2) 같은 draft 의 변경(4) Rationale 불릿에서 `oauthBegin` 자원 생성 예외를 narrowing 문구로 명시.
3. (WARNING #3) §5-4 체크리스트 예시에 `ApiAccepted* 202` 추가 또는 이름 나열 대신 "§2-4 표 전체" 참조로 교체.
4. (선택) `api-convention.md` §6 표에 swagger §2-4 로의 역참조 한 줄 추가(cross_spec INFO).
