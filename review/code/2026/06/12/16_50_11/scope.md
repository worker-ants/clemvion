# 변경 범위(Scope) 리뷰 결과

## 발견사항

발견된 범위 이탈 없음.

모든 변경이 plan/in-progress/chat-channel-followups-batch.md 에 명시된 G1-4, G1-3, G2-5, G3-6, G3-7 항목에 1:1 대응한다.

### 파일별 확인

**파일 1: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts`**
- plan G1-4 에 명시: `code: 'WORKSPACE_ID_REQUIRED'` 필드 단언 + 빈 문자열 헤더(falsy) 케이스 추가.
- 변경 내용: 기존 throw 테스트를 `WORKSPACE_ID_REQUIRED` code 단언 포함 테스트로 확장 + 빈 문자열(`''`) 헤더 케이스 신규 추가.
- 의도 이상의 변경 없음. 기존 테스트의 동작은 그대로 유지되고 단언이 강화됨.

**파일 2: `codebase/frontend/src/lib/i18n/backend-labels.ts`**
- plan G1-3 에 명시: `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 한국어 라벨.
- 변경 내용: `ERROR_KO` 에 `WORKSPACE_ID_REQUIRED` 키-값 1건 추가. 설명 주석 2줄 포함.
- 파일 전체 맥락에서 다른 항목은 전혀 수정되지 않았음.

**파일 3: `plan/in-progress/chat-channel-followups-batch.md`**
- 새로 생성된 plan 파일. 본 PR 의 작업 범위 자체를 정의하는 문서이므로 필수 파일.
- 내용이 실제 변경 목록과 일치함.

**파일 4: `plan/in-progress/spec-sync-chat-channel-gaps.md`**
- plan G2-5 에 명시: `spec-sync-chat-channel-gaps.md` 비고에 §7 동시 갱신 의무 note.
- 변경 내용: `## 비고` 끝에 1행 bullet 추가. 기존 내용 수정 없음.

**파일 5: `spec/5-system/1-auth.md`**
- plan G3-7 에 명시: `1-auth.md §1.1` resend-verification "인증 토큰 24h 유효" §5 와 동기화.
- 변경 내용: 표의 `인증 메일 재발송` 행 끝에 ". 발급되는 인증 토큰은 24h 유효 (§5 동일)" 문구 추가.
- 단일 셀 텍스트 보완이며 다른 행·섹션 변경 없음.

**파일 6: `spec/5-system/11-mcp-client.md`**
- plan G3-6 에 명시: `11-mcp-client.md §3.1` Internal Bridge 표에 `makeshop`/`MakeshopMcpToolProvider` 행 추가.
- 변경 내용: §3.1 표에 `makeshop` 행 1줄 추가. 다른 내용 변경 없음.

## 요약

6개 파일 모두 plan/in-progress/chat-channel-followups-batch.md 의 그룹 1·2·3 항목(G1-3, G1-4, G2-5, G3-6, G3-7)과 신규 plan 파일 자체에 한정되어 있다. 각 변경은 체크박스 항목과 1:1 대응하며, 포맷팅·임포트·불필요한 리팩토링·무관한 파일 수정이 전혀 없다. 범위 이탈이 없다.

## 위험도

NONE
