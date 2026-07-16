### 발견사항

- **[WARNING]** D1 정정이 동일 수치("~180")의 다른 2개 서술을 놓침
  - target 위치: D1 (`spec/4-nodes/4-integration/4-cafe24.md` L29·L446 만 정정)
  - 충돌 대상: `spec/2-navigation/4-integration.md:1110` (§14.2 워크플로우 에디터 — "Cafe24 의 경우 도구 수가 많아(Resource × Operation = ~180) allowlist UI 가 카테고리 단위 grouping 으로 노출된다"), `spec/4-nodes/3-ai/0-common.md:63` (`enabledTools` 필드 설명 — "Cafe24 의 경우 도구 수가 많아(~180) UI 는 Resource 단위 grouping 으로 노출")
  - 상세: grep 결과 `~180`/`카테고리당 평균 ~10`이 spec 전체에 정확히 4곳 존재하는데, D1 은 `4-cafe24.md` 의 2곳만 485 로 정정한다. 나머지 2곳(`2-navigation/4-integration.md` §14.2, `4-nodes/3-ai/0-common.md` §allowlist 필드표)은 그대로 `~180` 으로 남아, 본 draft 적용 직후 "Cafe24 오퍼레이션 총수"라는 동일 사실에 대해 spec 내부에 **485 와 ~180 두 값이 공존**하게 된다. 이는 본 draft 의 취지("수치 화석 정정")를 스스로 불완전하게 만드는 새로운 cross-spec 불일치다.
  - 제안: D1 범위에 위 2곳을 추가하거나(`~180` → `485`, 또는 "카테고리당 평균 ~27" 표현으로 통일), 최소한 draft 의 "비포함" 절에 "잔여 `~180` 표기 2곳(§14.2, §0-common allowlist 표)은 본 draft 범위 밖 — 별도 후속"이라고 명시해 의도적 누락임을 밝힐 것.

- **[WARNING]** plan 파일의 처분 번호와 draft 의 참조 번호가 불일치
  - target 위치: draft 상단 트리거 문구("처분(2) (3) (4)") 및 "비포함" 절("처분(1) out 포트 SoT")
  - 충돌 대상: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` — 실제 파일은 "Critical 1"(out 포트, 번호 없는 단일 체크박스)과 "Critical 2"(count_max, 처분 (1)(2)(3) 3개만 존재) 두 섹션으로 구성. **"처분(4)"라는 라벨은 파일 어디에도 없다.**
  - 상세: draft 는 out-포트 이슈를 암묵적으로 "처분(1)"로 세고 Critical 2 의 (1)(2)(3)을 (2)(3)(4)로 한 칸씩 밀어 참조한 것으로 보인다. 그러나 plan 파일 원문의 명시적 라벨은 Critical 2 내부에서만 (1)(2)(3) 로 재시작하고, Critical 1 은 번호가 없다. 실제 매핑은: plan 처분(1)="~180"→383 정정 = draft D1(485 사용, 383 대신 "집합 차이 명시" 대안 선택), plan 처분(2)=ai-agent 경고 = draft D2, plan 처분(3)=0-overview 각주 = draft D4. D3(mcp-client.md §5.8 보강)는 plan 에 대응 처분 항목이 아예 없는 draft 자체 추가 범위다. 이 번호 오프셋 때문에 draft 적용 후 plan 파일의 체크박스를 그대로 두면(라벨이 (1)(2)(3)뿐이므로) "처분(4) 완료" 라는 draft 의 주장을 plan 파일에서 확인할 방법이 없어 향후 plan 정리/완료 판정 시 혼선이 생긴다.
  - 제안: draft 를 `spec/`에 반영할 때 같은 PR 에서 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 의 Critical 2 처분(1)(2)(3) 체크박스를 실제 라벨 그대로 체크하고(처분(1)은 "383 대신 485 채택 — 카탈로그 상한 vs 계정 실측치 레이어 차이 명시"로 완료 사유 기록), Critical 1(out 포트, 번호 없음)만 남긴다는 사실을 plan 파일 자체에 명시할 것. draft 문서 내부에서도 "처분(2)(3)(4)" 대신 plan 파일이 실제 사용하는 라벨("Critical 2 의 처분(1)(2)(3) 전부 + D3 는 plan 범위 밖 추가")로 재서술 권장.

- **[INFO]** `cafe24-api-catalog/_overview.md` 는 이미 485 합계를 보유 — 충돌 아님, "~500" 도 별개 지표
  - target 위치: 검토 요청 관점 1 (485 vs `_overview.md` "~500")
  - 충돌 대상: `spec/conventions/cafe24-api-catalog/_overview.md` §5 Coverage Matrix (L95-118, "합계 | 485 | 0 | ~250") 와 L122("Cafe24 docs sub-resource 수" 기반 근사 "endpoint 합계는 ~500")
  - 상세: 직접 확인 결과 이 파일은 이미 카테고리별 breakdown(store 105 / order 104 / product 62 / … / personal 5)을 담은 Coverage Matrix 에서 **정확히 485** 를 합계로 기재하고 있으며, draft 의 "3중 교차검증" 수치·카테고리별 분포와 완전히 일치한다(직접 backend `metadata/*.ts` 의 `id:` 라인 카운트로 4번째 독립 검증도 수행 — 485 로 재확인됨). L122 의 "~500" 은 "Cafe24 docs 좌측 사이드바 sub-resource 항목 수"라는 **다른 방법론의 거친 근사치**(sub-resource 수 × "통상 2~5 operation" 추정)이며 자체적으로 "~"(근사) 로 표기돼 있어 485 라는 정밀 실측치와 병존 가능 — 정정 대상이 아니다.
  - 제안: 정정 불필요. 다만 D1 의 "근거"에 이 기존 Coverage Matrix(§5) 를 4번째 교차검증 소스로 인용하면 근거가 더 강해지고, 향후 감사자가 "485는 이 draft 가 처음 만든 수치"로 오인하지 않게 된다.

- **[INFO]** D3 의 "현행" 인용문이 실제 원문의 paraphrase — 문자열 치환 시 주의
  - target 위치: D3 (`spec/5-system/11-mcp-client.md` §5.8)
  - 충돌 대상: 실제 §5.8 본문(2문장 구조: "…allowlist 없이 전량 노출하면 도구 정의 payload 가 프롬프트를 provider transport timeout 너머로 밀어 provider 무관하게 응답 실패(hang/무한 재시도)를 유발할 수 있다. 따라서 대형 서버는 …좁히는 것이 권장된다.")
  - 상세: draft 가 "현행" 으로 인용한 문장은 실제 원문을 요약한 paraphrase 이며 글자 그대로 일치하지 않는다(원문은 "hang/무한 재시도" 언급 등 draft 인용문에 없는 구절 포함). 내용상 모순은 없으나, 이 draft 를 그대로 find-replace 스크립트나 문자열 매칭으로 적용하면 실패할 수 있다.
  - 제안: spec 반영 시 원문 2문장 구조를 유지하며 수치만 삽입하는 형태로 편집(문자열 완전 치환이 아니라 의미 편집)할 것.

### 요약

핵심 데이터(Cafe24 485 / MakeShop 161 / `AI_AGENT_TOOL_COUNT_MAX` 128 기본값)는 backend 메타데이터·카탈로그 파일을 직접 대조해 독립 재검증했으며 draft 의 수치·분포는 정확하다. D1~D4 가 건드리는 4개 위치(`4-cafe24.md` 2곳, `1-ai-agent.md` §4.2, `11-mcp-client.md` §5.8, `0-overview.md` §6.1) 는 다른 spec 영역과 데이터 모델·API 계약·상태 전이·RBAC 충돌이 없다. 다만 (a) 같은 "~180" 화석 수치가 spec 안에 실제로는 4곳 존재하는데 draft 는 2곳만 정정해 적용 직후 오히려 새로운 내부 불일치(485 vs ~180 공존)를 만들고, (b) draft 가 참조하는 plan 파일의 "처분(N)" 라벨과 draft 자체의 번호 매김이 어긋나 plan 완료 판정 시 혼선 소지가 있다. 두 건 모두 CRITICAL 급 모순은 아니지만 draft 의 "정정 draft" 라는 목적상 반영 전 보완이 바람직하다.

### 위험도
LOW
