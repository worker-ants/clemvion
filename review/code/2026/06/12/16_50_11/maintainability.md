# Maintainability Review

## 발견사항

### 파일 1: workspace.decorator.spec.ts

- **[WARNING]** 테스트 내 이중 실행(double invocation) 패턴 — `expect(() => factory(...)).toThrow` 후 동일 `factory` 를 `try/catch` 로 다시 호출하는 구조
  - 위치: 파일 122–134 라인 (`should throw BadRequestException with WORKSPACE_ID_REQUIRED code when no workspace ID is available` 블록)
  - 상세: `factory(undefined, ctx)` 가 두 번 실행된다. 첫 번째는 `expect().toThrow` 로 예외 존재만 확인하고, 두 번째는 `try/catch` 로 응답 내용을 단언한다. `expect().toThrow` 단언이 이미 예외를 소비하므로 두 번째 호출은 독립적이라 기능상 문제는 없지만, 가독성과 의도 전달이 모호하다. Jest 에서 `toThrow(BadRequestException)` 과 응답 필드 단언을 하나의 코드 블록으로 표현하고 싶다면 두 번째 `try/catch` 만 남기고 첫 번째 `expect().toThrow` 를 제거하거나, 반대로 `toThrowError` 체인으로 통합하는 것이 의도를 더 명확하게 한다.
  - 제안: 아래 두 방식 중 하나로 단순화
    ```ts
    // 방식 A: try/catch 단독
    try {
      factory(undefined, ctx);
      throw new Error('expected factory to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'WORKSPACE_ID_REQUIRED' }),
      );
    }
    // 방식 B: expect.assertions + toThrow 분리 테스트
    // (code 필드 단언과 타입 단언을 별도 it 블록으로 분리)
    ```

- **[INFO]** 빈 문자열 헤더 케이스 테스트(`should throw BadRequestException when X-Workspace-Id header is an empty string (falsy)`)는 `code: 'WORKSPACE_ID_REQUIRED'` 단언 없이 예외 타입만 검증한다
  - 위치: 파일 137–141 라인
  - 상세: 바로 위 테스트와 동작 조건이 유사한데 응답 내용 단언 수준이 다르다. 일관성을 위해 이 테스트에도 동일하게 `code` 단언을 추가하거나, 두 테스트의 의도적 차이를 주석으로 명시하면 유지보수 시 혼선을 줄인다.
  - 제안: `expect(() => factory(undefined, ctx)).toThrow(BadRequestException)` 뒤에 `code` 필드 단언 추가, 또는 의도 차이를 인라인 주석으로 설명

---

### 파일 2: backend-labels.ts

- **[INFO]** `WORKSPACE_ID_REQUIRED` 항목 추가 자체는 기존 패턴(`ERROR_KO` Record 에 항목 추가 + 인라인 주석)을 잘 따르고 있다. 변경 범위 내 유지보수성 문제 없음.

---

### 파일 3: plan/in-progress/chat-channel-followups-batch.md (신규 파일)

- **[INFO]** plan 파일은 코드 유지보수성 관점의 직접 대상이 아님. 내용·구조·추적성 관점에서는 기존 plan 파일 패턴을 준수하고 있다.

---

### 파일 4: plan/in-progress/spec-sync-chat-channel-gaps.md

- **[INFO]** `비고` 섹션에 새 항목(§7 동시 갱신 의무) 추가. 기존 비고 줄 스타일(`-` 불릿)과 일관되며 내용 목적도 명확하다. 유지보수성 문제 없음.

---

### 파일 5: spec/5-system/1-auth.md

- **[INFO]** `§1.1` 표의 "인증 메일 재발송" 셀에 `발급되는 인증 토큰은 24h 유효 (§5 동일)` 문구 추가. 기존 문장에 문장 중간에 `. ` 로 이어 붙이는 방식으로 기술되어 있어 셀이 다소 길어졌으나, 테이블 셀에 두 개념을 같은 줄에 두는 기존 spec 작성 패턴과 일치한다. 유지보수성 문제 없음.

---

### 파일 6: spec/5-system/11-mcp-client.md

- **[INFO]** `§3.1 Internal Bridge 적용 service_type` 표에 `makeshop` 행 추가. 기존 `cafe24` 행과 동일한 컬럼 구조(`service_type | Bridge 구현 | spec`)를 유지한다. 유지보수성 문제 없음.

---

### 파일 7: spec/5-system/15-chat-channel.md

- **[INFO]** `R-CC-18` Rationale 신설. 내용이 충분히 밀도 있고 기존 `R-CC-*` 패턴을 따른다. 유지보수성 문제 없음.

---

### 파일 8: spec/conventions/error-codes.md

- **[INFO]** §5 preamble 문구를 "외부에 노출된 적이 없다" → "외부 client 코드에 분기로 노출된 적이 없다(문서 목록에만 노출됐던 코드는 신규 코드로 동기화)" 로 정밀화하고, `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 이력 행 추가. 기존 패턴을 일관되게 따른다. 유지보수성 문제 없음.

---

## 요약

이번 변경의 대부분(파일 2~8)은 spec 문서·plan 파일·i18n 번역 테이블에 대한 보강으로, 기존 패턴을 잘 준수하고 있어 유지보수성 관점에서 특이사항이 없다. 유일하게 코드 레벨의 주의 사항은 `workspace.decorator.spec.ts` 의 테스트 한 블록으로, 동일한 팩토리를 `expect().toThrow` 와 `try/catch` 두 번 연속 호출하는 패턴이 의도를 모호하게 만든다. 실행상 오류는 없으나, 리뷰어나 미래 유지보수자 입장에서 "왜 두 번 실행하는가"를 즉시 이해하기 어렵다. `try/catch` 단독 또는 두 단언 블록 분리 방식으로 정리하면 가독성이 개선된다.

## 위험도

LOW
