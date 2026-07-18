# Plan 정합성 검토 — interaction-type 가드 주석 false-negative 해소

## 검토 대상 재확인

프롬프트 번들의 "target 문서" 섹션은 `spec/conventions/` 전반(audit-actions.md, cafe24-api-catalog/**)을 참조용으로 덤프하고 있으나, 말미의
"## 착수 예정 변경 (impl-prep 대상 — 이 변경을 기준으로 판정하세요)" 절이 실제 판정 대상이다. 이는 저장소의
`plan/in-progress/interaction-type-guard-comment-false-negative.md` (untracked, 이번 세션 신규 작성)와 정확히 일치한다.
cafe24-api-catalog/audit-actions 관련 파일들은 이번 변경과 무관한 컨텍스트 번들로 판단해 plan 정합성 판정에서 제외했다
(diff 없음 — `git diff origin/main --stat` 에 해당 경로 변경 0건, 최근 커밋 이력도 무관).

## 점검 절차

- `plan/in-progress/interaction-type-guard-comment-false-negative.md` 전문 확인
- `spec/conventions/interaction-type-registry.md` 전문 확인 (§1.2 rule 3, §2.1, §5 Rationale)
- `plan/in-progress/**` 전체에서 `interaction-type-registry|REGISTRY_SITES|exhaustiveness` grep → `eia-context-schema-followups.md` (완료 체크 항목, 무관), 본 plan 자신만 매치
- `plan/complete/*.md` 에서 동일 키워드 grep → 이 레지스트리의 이력(REGISTRY_SITES 모델 자체의 결정)은 모두 종결 상태, 열린 재논의 없음
- `git log` 로 `interaction-type-registry.ts`(satisfies+Exclude 소스 모듈)가 이미 `#968` 커밋으로 병합됐음을 확인 — 본 plan 의 "known limitation" 서술이 가리키는 선행 조건은 이미 해소됨
- `node-cancellation-inflight-followups.md` 등 다른 "결정 필요" 표기 plan 전수 확인 — interaction-type 가드와 무관(SMTP 등 별건)

## 발견사항

### [INFO] spec 잔여 "grep" 표현이 구현 전환 후 문자 그대로는 부정확해짐 (개정 불요 판단이지만 정밀화 여지)

- target 위치: `plan/in-progress/interaction-type-guard-comment-false-negative.md` "판정 요청" 절 — developer 가 (a) spec 개정 필요 vs (b) 구현이 spec 1차 명칭에 수렴 중 판단을 요청
- 관련 spec: `spec/conventions/interaction-type-registry.md` §1.2 rule 3 ("AST 가드 ... 등록된 **grep 대상 파일**"), §2.1 표 ("**grep 검증 대상**은 ... switch 1개뿐"), §5 Rationale ("AST 가드가 매트릭스 vs 코드 **grep 결과**를 build 단계에서 비교 fail")
- 상세: spec 은 이 가드를 일관되게 **"AST 가드"** 로 명명하면서도 서술 곳곳에서 검증 동작을 "grep" 으로 지칭한다. 현재 구현(정규식 매칭)은 사실 "grep" 이고 이름("AST 가드")과 실제 동작이 어긋나 있었다 — 이번 plan 의 판정 요청은 정확히 이 괴리를 인지하고 있다. 채택안(TS 컴파일러 API 로 실제 AST 파싱)은 **이름("AST 가드")에 구현을 수렴**시키는 방향이고, 검증하는 불변식("매트릭스의 모든 enum 값이 각 등록 사이트에 string literal 로 등장하는가")은 그대로 유지된다 — 계약(behavior contract) 변경이 아니라 판정 정확도 개선이므로 spec 개정을 요하는 "의미 충돌" 은 아니라고 판단한다(질문의 (b) 에 해당). 다만 §1.2/§2.1/§5 의 "grep" 잔여 표현은 구현 전환 후 문언 그대로는 부정확해지므로(실제로는 AST 노드 순회), 정밀도 관점에서 사소한 wording 정리(예: "grep 대상 파일" → "등록 사이트 파일", "코드 grep 결과" → "코드 AST 파싱 결과") 가치가 있다.
- 제안: CRITICAL/WARNING 아님 — developer 는 spec read-only 이므로 이번 plan 의 구현 자체를 막을 필요는 없다. impl-done 단계(`/consistency-check --impl-done`, 체크리스트 9-4)에서 이 wording 불일치가 다시 지적되면, project-planner 에게 "grep" 잔여 표현 정리만 다루는 트리비얼 spec 후속(별도 승인 불요 수준의 문구 정정)으로 위임하면 된다. 이번 plan 체크리스트에 명시적 분기가 없다는 점만 인지하고 있으면 충분 — 별도 plan 갱신을 강제할 정도는 아니다.

### 확인됨 — 충돌·미해소 선행조건 없음

- 다른 `plan/in-progress/**` 파일 중 이 가드의 구현 방식(정규식/AST)에 대해 "결정 필요"로 열어둔 항목 없음 — 본 plan 의 결정(§설계 결정)은 어떤 plan 의 미해결 결정과도 충돌하지 않는다.
- 선행 조건: 이 plan 이 배경으로 삼는 "PR #968 known limitation 이월" 은 이미 병합됨(`83b67b06b`) — 선행 plan 미해소 없음. `typescript` 는 이미 frontend devDependency(`^5`) 이며 `pnpm-migration-followups.md` 의 이미지 위생 가드도 devDependency 는 제외 대상으로 명시 — 충돌 없음.
- 후속 항목: "known limitation" 서술은 대상 테스트 파일 자체의 JSDoc 에만 존재하고 별도 plan/backlog 항목으로 추적되고 있지 않으므로, 이 plan 완료로 무효화되거나 갱신이 누락될 다른 plan 의 후속 항목은 없음. `interaction-type-registry.md` frontmatter `code:` 에 대상 테스트 파일이 이미 등재돼 있어 impl-done 게이트가 정상 작동할 것으로 판단.

## 요약

target(`interaction-type-guard-comment-false-negative.md`, 정규식 grep → TS 컴파일러 AST 파싱 전환)은 `plan/in-progress/**` 의 어떤 미해결 결정도 우회하지 않고, 선행 조건(PR #968 병합, typescript devDependency 존재)도 이미 충족돼 있으며, 다른 plan 의 후속 항목을 무효화하지도 않는다. 유일한 관찰은 spec `interaction-type-registry.md` 의 "grep" 잔여 표현이 구현 전환 후 문언상 정밀도가 떨어진다는 점이나, 이는 계약 변경이 아닌 wording 이슈로 판단되어 이 plan 을 막을 사유가 아니다(트리비얼 spec 후속으로 충분).

## 위험도
LOW
