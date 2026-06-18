import re

with open("src/components/Tabs/Tabs.test.tsx", "r") as f:
    content = f.read()

# remove the appended part
content = content.split('});\n});')[0] + '});\n'

# append it inside the describe block
test_case = """
  it("calls setActiveTab with Settings when Settings tab is clicked", () => {
    const setActiveTab = vi.fn();
    render(
      <Tabs
        activeTab={Tab.Search}
        setActiveTab={setActiveTab}
        searchCount={10}
        favoritesCount={2}
        trashCount={1}
      />
    );

    fireEvent.click(screen.getByText("Settings"));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.Settings);
  });
});
"""

content += test_case

with open("src/components/Tabs/Tabs.test.tsx", "w") as f:
    f.write(content)
