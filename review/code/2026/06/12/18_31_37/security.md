# 보안(Security) Review

## 발견사항

### 파일: spec/conventions/cafe24-api-catalog/_generator.py

- **[INFO]** 경로 트래버설 이론적 가능성 — `entity_id` 기반 캐시 파일 경로
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/spec/conventions/cafe24-api-catalog/_generator.py` line 77 (`cache = os.path.join(cache_dir, entity_id + ".json")`)
  - 상세: `entity_id` 값이 검증 없이 `os.path.join` 에 직접 사용된다. `entity_id` 가 `../../../etc/passwd` 같은 값을 포함하면 `cache_dir` 바깥 경로에 파일을 읽거나 쓸 수 있다. 동일한 `entity_id` 가 URL 구성(`RESP_BASE + entity_id + ".json"`, line 84)에도 사용되므로 SSRF 가능성도 이론적으로 존재한다. 그러나 이 스크립트는 개발자가 직접 실행하는 CLI 도구이고, `entity_id` 는 신뢰된 Cafe24 공식 HTML 파싱 결과로부터 추출된다. 외부 사용자 입력을 받지 않으므로 실제 공격면은 극히 제한적이다.
  - 제안: 방어적 코딩 차원에서 `os.path.basename(entity_id)` 를 사용하거나, `resolved = os.path.abspath(os.path.join(cache_dir, entity_id + ".json"))` 후 `resolved.startswith(os.path.abspath(cache_dir))` 검사를 추가. URL 구성 부분도 동일하게 sanitize.

---

### 파일: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** 에러 코드 문자열이 프론트엔드에 노출 — 정보 누출 수준 확인
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/codebase/frontend/src/lib/i18n/backend-labels.ts` — 추가된 `ERROR_KO` 항목 (`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`)
  - 상세: 이 파일은 프론트엔드 번들에 포함되는 i18n 매핑 테이블이다. 에러 코드 문자열 자체는 공개 API에서도 이미 반환되므로 추가적인 정보 노출이 없다. 메시지 내용도 사용자 안내용으로 작성되어 있으며 내부 구현 경로·스택·시스템 정보를 포함하지 않는다. 보안상 문제 없음.
  - 제안: 현 상태로 적절.

---

### 파일: codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts

- **[INFO]** 테스트 파일 — 보안 관련 직접 위험 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`
  - 상세: 추가된 테스트 케이스는 i18n 번역 동작 검증 전용이다. 하드코딩된 시크릿 없음. 테스트 fallback 문자열(`"english fallback for ${code}"`)은 실제 시크릿이 아니다. 보안상 문제 없음.
  - 제안: 없음.

---

### 나머지 파일 (MDX 문서, plan 파일, review 산출물)

- **[INFO]** 문서·계획·리뷰 파일은 보안 취약점과 무관
  - 상세: `triggers.mdx`, `triggers.en.mdx`, `plan/complete/fix-spec-frontmatter-catalog.md`, `plan/in-progress/spec-sync-chat-channel-gaps.md`, `review/code/2026/06/12/18_01_52/` 하위 파일들은 모두 문서 및 메타데이터 파일이다. 하드코딩된 시크릿, 인젝션 취약점, 인증 로직 없음.
  - 제안: 없음.

---

## 요약

이번 변경 세트의 보안 위험은 낮다. 유일한 주목할 만한 항목은 `_generator.py`의 `entity_id` 기반 경로 구성에서 발생하는 이론적 경로 트래버설 가능성으로, 이는 이전 리뷰(SUMMARY.md INFO#2)에서도 이미 기록된 사항이다. 그러나 해당 스크립트가 신뢰된 개발자 전용 CLI이고 `entity_id` 가 Cafe24 공식 HTML에서만 추출된다는 점에서 실제 공격면이 존재하지 않는다. `backend-labels.ts`에 추가된 에러 코드 매핑은 이미 공개 API 응답에 포함되는 코드들이며 내부 정보를 노출하지 않는다. 하드코딩된 시크릿, 인증/인가 우회, 인젝션 취약점, 안전하지 않은 암호화는 전혀 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
