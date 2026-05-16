# 변경 범위(Scope) 리뷰

## 발견사항

### 1. HMAC 재정정과 무관한 spec 변경 포함 (§2, §9.9 ux-cleanup 내용)

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` 의 §2 필드 UI 설명과 §9.9 재작성이 HMAC 알고리즘 수정 범위를 벗어남
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` lines 54-58 (§2), lines 2081-2095 (§9.9)
  - 상세: 이 PR의 의도는 HMAC 검증 알고리즘을 `formUrlEncode` 방식에서 raw URL-encoded 값 보존 방식으로 재정정하는 것이다. 그런데 §2의 Fields 편집 버퍼 설명 제거 + 메타데이터 기반 동적 폼 설명 + 호환 키 보존 + Operation 후보 표시 방식 등의 변경, 그리고 §9.9 전체 재작성(KeyValueEditor vs 메타데이터 기반 동적 폼)은 HMAC 수정과 무관한 Phase 3/4 ux-cleanup 작업 결과물이다. CHANGELOG에서도 `(ux-cleanup)` 행과 `(hmac-raw-fix)` 행이 같은 커밋에 함께 포함되어 있어, HMAC 픽스와 별개 트랙인 ux-cleanup 변경이 이 PR에 혼입된 것으로 보인다.
  - 제안: §9.9 재작성과 §2의 ux-cleanup 관련 변경(Fields 편집 버퍼 제거, Operation 후보 표시, Pagination 분기 설명)은 별도 PR(`ux-cleanup` 트랙)에 분리하거나, 이미 별도 PR #89가 처리했다면 해당 변경이 이 PR에 중복 포함되지 않아야 한다.

---

### 2. App URL 카드 기능 추가가 HMAC 알고리즘 픽스 범위를 벗어남

- **[WARNING]** `spec/2-navigation/4-integration.md` 에 Cafe24 App URL 상세 페이지 표시(카드 추가) 관련 spec이 포함됨
  - 위치: `spec/2-navigation/4-integration.md` line 1920 (§4.2 표에 App URL 카드 행 추가), lines 1928-1929 (§9.2 API 설명 변경 — `appUrl: string | null` 필드 추가), lines 1947-1955 (Rationale "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 항)
  - 상세: App URL 카드(`Cafe24AppUrlCard`)를 통합 상세 페이지에 추가하고, `IntegrationDto.appUrl: string | null` 필드를 백엔드 응답에 포함하는 내용은 HMAC 검증 알고리즘 재정정과 별개의 기능이다. Rationale에도 "2026-05-16 사용자 보고 — App URL 호출이 HMAC으로 거부됐을 때 비교 기준이 없었다"고 언급하는데, 이는 HMAC 알고리즘 버그 수정이 아닌 UX 개선 기능 추가다. 두 변경이 운영 문제의 같은 사용자 보고에서 비롯됐지만, 기능 범위는 명확히 다르다.
  - 제안: App URL 카드 관련 spec 변경(§4.2 App URL 카드 행, §9.2 API `appUrl` 필드 설명, Rationale "Cafe24 App URL 상세 페이지 표시") 은 HMAC 알고리즘 수정 PR과 분리해야 한다. 단, 두 변경이 같은 운영 이슈 대응으로 동시에 계획됐고 이미 하나의 PR로 진행하는 것이 팀 합의라면 INFO로 하향 조정 가능.

---

### 3. install_token 보존 정책 변경이 HMAC 픽스 PR에 포함됨

- **[INFO]** `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/2-navigation/4-integration.md` TTL 기준 단락의 install_token 보존 정책 정정이 포함됨
  - 위치: `spec/1-data-model.md` lines 1894-1897 (install_token / install_token_issued_at 컬럼 설명), `spec/data-flow/5-integration.md` line 2125 (sequence diagram UPDATE 쿼리), `spec/2-navigation/4-integration.md` lines 1937-1938 (TTL 기준 단락)
  - 상세: `install_token`의 "callback 성공 시 NULL → 보존" 정책 정정과 `spec/data-flow/5-integration.md` sequence diagram 수정은 HMAC 알고리즘 재정정(`buildHmacMessage`)과 직접 관련이 없다. consistency-check 세션 `12_24_55`가 이 spec 정정을 대상으로 실행된 별도 작업(worktree `cafe24-app-url-detail-a7c3f4`)의 결과물이며, 해당 세션도 이 PR에 포함되어 있다.
  - 제안: install_token 보존 정책 정정은 이 PR과 독립적인 변경이지만, 동일 사용자 보고 이슈 대응 흐름 중에 발견된 drift fix이며 범위가 좁고 연관성이 있다. 단, 이로 인해 PR의 제목/목적(`cafe24-hmac-raw-fix`)과 실제 변경 범위가 불일치한다는 점을 기록한다.

---

### 4. 이전 consistency-check 세션 파일 3개가 이 PR에 포함됨

- **[INFO]** `review/consistency/2026/05/16/12_24_55/`, `review/consistency/2026/05/16/13_09_46/`, `review/consistency/2026/05/16/13_29_47/` 세션이 포함됨
  - 위치: 파일 1-15 (review/consistency/2026/05/16/{12_24_55, 13_09_46, 13_29_47} 하위 파일 전체)
  - 상세: 이 세 세션은 각각 (1) install_token 보존 정책 spec 정정 검토, (2) Cafe24 Node UX Phase 3 frontend 재작성 검토, (3) Phase 4 spec §9.9 ux-cleanup 검토 세션이다. worktree 이름 `cafe24-hmac-raw-fix-b8e2d1`에서 수행된 작업이 아닌, 다른 worktree/작업의 consistency-check 결과물이다. 이 파일들이 HMAC 재정정 PR에 포함된 것은 review 아카이브가 이 worktree에서 생성됐기 때문으로 보인다.
  - 제안: `review/consistency/` 하위 파일은 시점 기록 성격으로 경로를 그대로 두는 것이 프로젝트 규약이므로, 이 세션 파일들 자체는 문제가 없다. 다만 이 세션들이 HMAC 픽스 PR의 변경 파일 목록에 포함된 것은 HMAC 픽스 PR의 변경 의도와 무관한 파일이 포함됐음을 뜻하므로 scope 관점에서 기록한다.

---

### 5. `review/consistency/2026/05/16/14_06_49/_prompts/` 파일 포함 (prompt 인풋 파일)

- **[INFO]** consistency-check orchestrator가 생성한 프롬프트 파일 5개(`_prompts/*.md`)가 PR에 포함됨
  - 위치: 파일 17-21 (review/consistency/2026/05/16/14_06_49/_prompts/ 하위)
  - 상세: `_prompts/` 디렉토리는 orchestrator가 sub-agent 호출을 위해 임시로 작성하는 입력 파일 모음이다. 이 파일들은 review 산출물이 아니라 review 프로세스 실행 인프라 파일이다. 프로젝트 규약에서 이 파일을 PR에 포함해야 하는지 명시하지 않고 있으나, consistency-check 세션 디렉토리 구조(`SUMMARY.md + 5 checker별 review.md + meta.json`)를 볼 때 `_prompts/`는 재현성 목적으로 함께 보관하는 것으로 보인다. 실질적인 scope 일탈은 아니나, `_prompts/` 파일이 대용량(각 수십 KB)이어서 코드 리뷰 노이즈를 발생시킬 수 있다.
  - 제안: `_prompts/` 포함 여부를 CLAUDE.md의 review 디렉토리 컨벤션에 명시적으로 정의하는 것을 권장한다. 현재 운영 방식이 맞다면 INFO로 종결.

---

## 요약

이 PR(`cafe24-hmac-raw-fix-b8e2d1`)의 핵심 변경인 HMAC 알고리즘 재정정(§9.8 `buildHmacMessage` raw 보존, CHANGELOG `hmac-raw-fix` 행, Rationale 신규 항)은 의도된 범위 내에 있다. 그러나 변경 파일 목록에는 이와 무관한 변경이 상당수 포함되어 있다. 가장 두드러진 것은 §2/§9.9 ux-cleanup 재작성(Phase 3/4 결과물)과 App URL 상세 카드 기능 추가(spec §4.2, §9.2 API 설명, Rationale)로, 이 두 변경은 HMAC 픽스와 독립적인 기능 트랙이다. install_token 보존 정책 정정(`spec/1-data-model.md`, `spec/data-flow/5-integration.md`, TTL 기준 단락)은 같은 사용자 보고에서 비롯된 drift fix이나 역시 HMAC 알고리즘 자체와 직접 관련이 없다. consistency-check 세션 파일들(12_24_55, 13_09_46, 13_29_47)은 다른 작업의 리뷰 아카이브로 HMAC 픽스 PR의 의도와 무관하다. 전반적으로 의도한 핵심 변경(HMAC 알고리즘)은 명확하고 올바르게 기술됐으나, 여러 다른 트랙의 변경이 하나의 PR로 묶여 리뷰 가독성과 롤백 단위 관리가 복잡해진다.

## 위험도

MEDIUM
