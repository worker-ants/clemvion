# 유지보수성(Maintainability) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스 **전체** 를 유지보수성 관점에서 면밀히 검토한다.

## 사용자 강조 관점

병렬 작업으로 누적된 일관성 흠집 점검:

1. **일관성** — 명명·구조·패턴·에러 처리·로깅
2. **스펙 준수** — `spec/conventions/` 의 코딩 규약
3. **보안** — 가독성 부족이 보안 검토를 방해
4. **리팩토링** — 누적 복잡도·중복

## 최근 병렬 작업 컨텍스트

- cafe24 followup 30+ 커밋 — 같은 영역 반복 수정 → 누적 인지 부하
- 여러 worktree 가 같은 패턴을 따로 구현했을 가능성
- `bb038f90 refactor(integrations): ai-review 후속 — W1·W2·W3·W4 + INFO 5건 처리` 같은 묶음 리팩토링이 의도대로 완결되었는지

## 검토 범위

- `codebase/backend/src/modules/integrations/` — 가장 hot 한 영역, 누적 변경 검토
- `codebase/backend/src/nodes/` — 노드별 패턴 일관성
- `codebase/frontend/src/components/` — 컴포넌트 구조·prop drilling·중복
- `spec/conventions/` — 정식 규약과 코드 부합
- `packages/` — 패키지 내부 구조

## 작업 지침

1. **명명**: 같은 도메인의 변수·함수·파일명이 일관되는지
2. **함수 길이/중첩**: 50줄 초과, depth 4+ 중첩
3. **매직 넘버/문자열**: 의미 없는 리터럴
4. **중복**: 비슷한 패턴 3회+ 반복
5. **복잡도**: 한 함수가 너무 많은 책임
6. **데드 코드**: 미사용 export, unused parameter, 주석 처리된 코드
7. **TODO/FIXME 잔존**: 정리되지 않은 임시조치
8. **로깅 일관성**: console.log vs logger, 로그 레벨, 메시지 형식
9. 결과는 `output_file` 에 Write.

## 출력 형식

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line>
  - 상세
  - 제안

### 요약
1 문단

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: 다음 변경이 사실상 불가능한 영역. WARNING: 자주 수정되는 곳의 가독성 저하. INFO: 정리 권고.
