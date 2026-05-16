# 변경 범위(Scope) 리뷰

## 발견사항

### 의도된 변경 범위 요약

이 PR의 목적은 `/integrations` 페이지 "주의 필요" 배너의 클릭 동작 버그(항상 `?status=expiring`만 적용)를 수정하고, `attention` 가상 필터값을 도입하는 것이다. plan 문서(`plan/in-progress/integration-attention-filter.md`)에 명확히 기술되어 있다.

---

- **[INFO]** `plan/in-progress/integration-attention-filter.md` — 신규 plan 파일 포함
  - 위치: 파일 11 (diff 전체)
  - 상세: plan 파일 생성은 프로젝트 규약(worktree 기반 작업 정책)에 따른 정상 산출물이다. 해당 plan 의 체크리스트 항목 일부(`[ ]`)가 아직 미완료 상태로 표시되어 있으나 이는 의도된 진행 중 상태이므로 범위 위반이 아니다.
  - 제안: 해당 없음.

- **[INFO]** `review/consistency/2026/05/16/13_26_15/SUMMARY.md` 및 `_prompts/convention_compliance.md` — 리뷰 산출물 포함
  - 위치: 파일 12, 파일 13
  - 상세: consistency-check 실행 결과 문서와 프롬프트 파일이 diff에 포함되어 있다. 이는 구현 착수 전 필수 절차(`/consistency-check --impl-prep`)의 산출물로 `review/consistency/**` 경로에 위치하며 프로젝트 규약을 준수한다. 코드 변경과 무관한 파일이지만 PR 번들에 포함되는 것은 관행상 허용 범위다.
  - 제안: 해당 없음. 다만 향후 리뷰어 편의를 위해 consistency-check 산출물은 별도 commit 으로 구분하는 것을 고려할 수 있다.

- **[INFO]** `frontend/src/app/(main)/integrations/page.tsx` — `needsAttention` 임포트 제거
  - 위치: 파일 7, 라인 `import { StatusBadge, needsAttention } from "./_shared/status-badge";`
  - 상세: `needsAttention`이 직접 임포트 목록에서 제거되고 `computeAttentionBreakdown`과 `AttentionBreakdown` 타입으로 교체되었다. `needsAttention`은 `computeAttentionBreakdown` 내부에서 위임 호출되므로 사용처는 실질적으로 유지된다. 불필요한 임포트 제거가 아닌 API 리팩토링에 수반된 자연스러운 변경이다.
  - 제안: 해당 없음.

- **[INFO]** `frontend/src/app/(main)/integrations/page.tsx` — `STATUS_FILTERS`에 `attention` 칩 추가
  - 위치: 파일 7, 라인 +517
  - 상세: plan §안 A "프론트 — `STATUS_FILTERS` 에 `{ value: "attention" }` 추가"에 명시된 의도된 기능이다. `attention` 필터를 전체 목록 상단("All" 바로 다음)에 배치한 것은 UX 설계 판단으로 범위 내 결정이다.
  - 제안: 해당 없음.

- **[INFO]** `frontend/src/app/(main)/integrations/page.tsx` — `AttentionBanner` 컴포넌트 추출
  - 위치: 파일 7, 라인 +569~+636
  - 상세: 기존 인라인 배너 JSX를 `AttentionBanner`라는 별도 함수 컴포넌트로 추출했다. 코드량이 늘었지만 이는 breakdown 표시·단일 건 분기·색상 톤 분기 등 신규 스펙 요구사항을 수용하기 위한 자연스러운 구조화로, 현재 작업 목적(스펙 §2.4 구현)과 직접 연관된다. 범위 이탈로 판단하기 어렵다.
  - 제안: 해당 없음.

- **[WARNING]** `frontend/src/lib/i18n/dict/en/integrations.ts` — `attentionSingle` 키 삭제
  - 위치: 파일 9, 라인 `-707`
  - 상세: 기존 키 `attentionSingle: "1 integration needs attention"` 이 삭제되었다. 삭제 자체는 plan에 명시된 "옛 키 제거" 계획과 일치하지만, 이 키가 실제로 이 파일 외 다른 곳에서 참조되는지 diff만으로는 확인이 안 된다. 만약 삭제 전 사용처 검색을 건너뛰었다면 런타임 i18n miss 가 발생할 수 있다.
  - 제안: `attentionSingle` 키의 기존 사용처를 `grep -r "attentionSingle"` 으로 확인해 사용처가 없음을 검증한다. (plan 설명에 "사용처 한 곳뿐"으로 언급되어 있어 실제 위험은 낮으나 확인 권장.)

- **[WARNING]** `frontend/src/lib/i18n/dict/ko/integrations.ts` — 동일하게 `attentionSingle` 삭제
  - 위치: 파일 10, 라인 `-747`
  - 상세: 위 영문 dict 건과 동일한 사유.
  - 제안: 동일.

---

## 요약

이 PR의 변경은 전반적으로 `attention` 가상 필터값 도입이라는 단일 목적에 충실하다. 백엔드 DTO·서비스 분기, 프론트엔드 타입·배너·필터칩·i18n, 단위 테스트, plan 문서, consistency-check 산출물 모두 plan에 명시된 범위 내 변경이다. 불필요한 리팩토링이나 무관한 파일 수정은 발견되지 않는다. 유일한 관찰 사항은 `attentionSingle`(en/ko) 키 삭제인데, 사용처가 단 한 곳(page.tsx)이었고 해당 코드가 이번 PR에서 함께 교체되었다고 plan에 기술되어 있어 실제 위험은 낮다. consistency-check 산출물(`review/consistency/...`)이 diff에 포함된 것은 규약 준수 범위이나 별도 commit 분리를 고려할 만하다.

## 위험도

LOW
