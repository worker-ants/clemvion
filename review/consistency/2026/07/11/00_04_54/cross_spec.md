No additional occurrences elsewhere. This confirms D-3's 3-location count is complete. Now let me compile the final findings.

## 발견사항

- **[WARNING] D-2 상태 승격이 `spec/0-overview.md` §6.2 의 동일 stale 서술과 새 모순을 만든다**
  - target 위치: 변경안 D-2 (`2-navigation/_product-overview.md` NAV-WC-06 `🚧` → `✅`)
  - 충돌 대상: `spec/0-overview.md` §6.2 "임베드형 웹채팅 위젯 + SDK" 행 — `"라이브 미리보기는 위젯 co-deploy 후 증분 2"` (NAV-WC-06 현재 오기재와 문구까지 동일한 stale 서술), 그리고 이 행 자체가 §6.1(완료 ✅) 이 아닌 §6.2(백엔드만 존재/부분 구현 🚧) 에 남아 있음
  - 상세: 실증 결과 `spec/7-channel-web-chat/` 6문서 전부 `status: implemented`, `5-admin-console.md` §6·R5·R6·R7 이 라이브 미리보기를 완성 기능으로 상세 기술하며, `live-preview.tsx` + 테스트 + `web-chat/page.tsx:41` 렌더까지 확인돼 D-2 의 flip 근거는 타당하다. 그러나 `spec/0-overview.md:88`(§6.2) 은 **동일한 stale 문구**("위젯 co-deploy 후 증분 2")를 그대로 갖고 있고, 같은 셀 안에서조차 "영역 spec 6문서 전부 `implemented`(영역 종결)" 이라 말하면서 행 자체는 §6.1 이 아닌 §6.2 에 위치하는 기존 자기모순을 안고 있다. D-2 를 `2-navigation/_product-overview.md` 에만 적용하면, PR 직후 "NAV-WC-06 ✅ vs `0-overview.md` §6.2 여전히 🚧 + 동일 stale 문구" 라는 **새로운 cross-doc 불일치**가 즉시 발생한다 — 이번 drift-fix 가 없애려는 것과 정확히 같은 클래스의 문제가 다른 파일에 남는다.
  - 제안: D-2 범위에 `spec/0-overview.md` §6.2 를 포함시켜 "위젯 co-deploy 후 증분 2" 문구 제거 + 해당 행을 §6.1(구현 완료)로 승격(또는 최소한 "라이브 미리보기 완료" 로 문구 정정)한다. 범위를 좁게 유지하고 싶다면 target 문서에 "D-2 는 `2-navigation` 만 다루고 `0-overview.md` §6.2 동기화는 별도 후속" 이라는 명시적 스코프 각주를 추가해 누락이 아님을 표시한다.

- **[INFO] R-D1 의 "SSE 동시 3/execution 은 EIA §5.2 소관" 인용이 부정확**
  - target 위치: Rationale R-D1 괄호 문구("SSE 동시 3/execution 은 EIA §5.2 소관이므로 함께 참조로 정리한다")
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §8.4 (line 735, SSE 동시 연결 = execution 당 3, 구현됨 — 실제 수치·구현상태 표는 §8.4 소속). §5.2 는 SSE 엔드포인트 자체(`GET /api/external/executions/:id/stream`)의 스펙만 정의하며, 동시 연결 상한 수치는 등장하지 않는다. §5.2 는 §8.4 와 함께 에러 코드 표(line 344)에서만 병기 인용된다.
  - 상세: D-1 이 4-security.md §4 의 SSE/interact 서술을 "EIA §8.4 참조" 로 축약하는 실제 편집 방향과는 무관하지만, Rationale 문구가 "§5.2 소관" 이라 명시해 두면 후속 독자가 SSE 동시 제한 수치의 SoT 를 §5.2 로 오인할 수 있다.
  - 제안: R-D1 문구를 "SSE 동시 3/execution 도 (§8.4 표에 함께 있으므로) 같이 참조로 정리한다"로 정정하거나 §5.2 언급을 제거한다.

- **[INFO] D-3 "3곳" 산정이 실제 occurrence 4건을 섹션 단위로 묶은 것**
  - target 위치: D-3 목록 (3-auth-session.md:44 · 4-security.md §3-① · 4-security.md Rationale I3)
  - 상세: 실제 grep 결과 unwrap 표기는 `4-security.md` 안에서만 2곳(line 102 `EmbedConfigDto { allowlist, enforce }`, line 109 `{ allowlist: [], enforce: false }`)이 §3-① 하나로 묶여 있다. 셈이 틀린 건 아니지만 실제 편집 시 §3-① 내 두 문장을 모두 고쳐야 "3곳" 이 실제로 해소된다.
  - 제안: 정보 제공용. 실 편집 시 §3-① 안의 두 occurrence 를 모두 포함했는지 체크리스트에 명시하면 누락 방지에 도움.

### 요약

target 은 사전 존재 spec drift 3건(D-1 rate-limit "Planned" 오기재, D-2 NAV-WC-06 stale 배지, D-3 embed-config 봉투 표기 누락)을 정정하는 순수 문서 수정 plan이며, 세 건 모두 실제 코드(`interaction.controller.ts`, `live-preview.tsx`+테스트+렌더 확인, `hooks.controller.ts`/`use-widget.ts`)와 SoT 문서(EIA §8.4, `5-admin-console.md`, `swagger.md`)로 교차 검증한 결과 각 판단(SoT 방향)은 정확하다. 새 엔티티·API 계약·요구사항 ID·상태 머신·RBAC 은 도입하지 않아 그 축에서는 충돌이 없다. 다만 D-2 는 범위가 좁아 `spec/0-overview.md` §6.2 에 남아 있는 동일한 stale 문구("위젯 co-deploy 후 증분 2")와 새로운 cross-doc 모순을 만든다 — 이 문서가 정확히 없애려는 클래스의 drift가 target 적용 직후 다른 위치에 다시 생기는 셈이라 WARNING으로 표시했다. 나머지는 INFO 수준의 인용 정밀도 문제다.

### 위험도
LOW